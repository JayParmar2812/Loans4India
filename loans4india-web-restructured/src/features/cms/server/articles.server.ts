import "server-only";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";
import { articleDataSchema, articleProblems, slugProblem, type ArticleData } from "@/features/cms/domain/article";

type Tx = Prisma.TransactionClient;
export class CmsRule extends Error {}

const parse = (json: string): ArticleData | null => {
  const r = articleDataSchema.safeParse(JSON.parse(json));
  return r.success ? r.data : null;
};

async function audit(tx: Tx, type: string, actor: string, target: string, detail: Record<string, unknown> = {}) {
  await tx.adminEvent.create({ data: { type, actor, target, detail: JSON.stringify(detail) } });
}

async function newRevision(tx: Tx, articleId: string, data: ArticleData, actor: string, note: string | null) {
  const last = await tx.articleRevision.findFirst({ where: { articleId }, orderBy: { version: "desc" }, select: { version: true } });
  return tx.articleRevision.create({ data: { articleId, version: (last?.version ?? 0) + 1, data: JSON.stringify(data), note, createdBy: actor } });
}

// ---------- Editorial workflow ----------

export async function createArticle(slug: string, data: ArticleData, actor: string) {
  const sp = slugProblem(slug);
  if (sp) throw new CmsRule(sp);
  if (await prisma.article.findUnique({ where: { slug } })) throw new CmsRule("A guide already uses that address.");
  const { problems } = articleProblems(data, "save");
  if (problems.length) throw new CmsRule(problems[0]);
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.create({ data: { slug, category: data.category, createdBy: actor } });
    const rev = await newRevision(tx, a.id, data, actor, "Created");
    await tx.article.update({ where: { id: a.id }, data: { draftRevisionId: rev.id } });
    await audit(tx, "ARTICLE_CREATED", actor, `/guides/${slug}`);
    return a;
  });
}

/** Save the working draft as a new revision. The live version is untouched; the draft goes back to DRAFT. */
export async function saveDraft(id: string, raw: unknown, note: string | null, actor: string) {
  const { data, problems } = articleProblems(raw, "save");
  if (!data || problems.length) throw new CmsRule(problems[0]);
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    const rev = await newRevision(tx, id, data, actor, note);
    await tx.article.update({ where: { id }, data: { draftRevisionId: rev.id, status: "DRAFT", category: data.category, reviewRequestedBy: null } });
    await audit(tx, "ARTICLE_DRAFT_SAVED", actor, `/guides/${a.slug}`, { version: rev.version, note });
    return rev;
  });
}

export async function requestReview(id: string, actor: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    if (a.status === "IN_REVIEW") throw new CmsRule("Already waiting for approval.");
    if (!a.draftRevisionId) throw new CmsRule("Nothing to review.");
    if (a.draftRevisionId === a.liveRevisionId) throw new CmsRule("The draft is the same as what's live. Make a change first.");
    const rev = await tx.articleRevision.findUniqueOrThrow({ where: { id: a.draftRevisionId } });
    const { problems } = articleProblems(JSON.parse(rev.data), "publish");
    if (problems.length) throw new CmsRule(problems[0]);
    await tx.article.update({ where: { id }, data: { status: "IN_REVIEW", reviewRequestedBy: actor } });
    await audit(tx, "ARTICLE_REVIEW_REQUESTED", actor, `/guides/${a.slug}`, { version: rev.version });
  });
}

/**
 * Approve and publish (or schedule) the draft under review. Four-eyes: the approver can't be the person who wrote
 * the draft or asked for review. Validation runs again at this moment.
 */
export async function approveAndPublish(id: string, actor: string, publishAt: Date | null) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    if (a.status !== "IN_REVIEW" || !a.draftRevisionId) throw new CmsRule("Only a guide waiting for approval can be published.");
    const rev = await tx.articleRevision.findUniqueOrThrow({ where: { id: a.draftRevisionId } });
    if (rev.createdBy === actor || a.reviewRequestedBy === actor) throw new CmsRule("Someone other than the author must approve this guide.");
    const { problems } = articleProblems(JSON.parse(rev.data), "publish");
    if (problems.length) throw new CmsRule(problems[0]);
    await tx.article.update({
      where: { id },
      data: { status: "PUBLISHED", liveRevisionId: rev.id, publishAt, publishedBy: actor, publishedAt: new Date(), reviewRequestedBy: null },
    });
    await audit(tx, "ARTICLE_PUBLISHED", actor, `/guides/${a.slug}`, { version: rev.version, publishAt: publishAt?.toISOString() ?? null });
  });
}

export async function sendBack(id: string, actor: string, reason: string) {
  if (!reason.trim()) throw new CmsRule("Say what needs changing.");
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    if (a.status !== "IN_REVIEW") throw new CmsRule("This guide isn't waiting for approval.");
    await tx.article.update({ where: { id }, data: { status: "DRAFT", reviewRequestedBy: null } });
    await audit(tx, "ARTICLE_SENT_BACK", actor, `/guides/${a.slug}`, { reason });
  });
}

/** Take a guide off the public site. Search engines get a 404; the draft and history stay. */
export async function unpublish(id: string, actor: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    if (!a.liveRevisionId) throw new CmsRule("This guide isn't published.");
    await tx.article.update({ where: { id }, data: { liveRevisionId: null, publishAt: null, status: a.draftRevisionId === a.liveRevisionId ? "DRAFT" : a.status } });
    await audit(tx, "ARTICLE_UNPUBLISHED", actor, `/guides/${a.slug}`);
  });
}

/** Restore copies an old revision into a new draft revision (history is never rewritten). */
export async function restoreRevision(id: string, revisionId: string, actor: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    const old = await tx.articleRevision.findFirst({ where: { id: revisionId, articleId: id } });
    if (!old) throw new CmsRule("Revision not found.");
    const data = parse(old.data);
    if (!data) throw new CmsRule("That revision no longer matches the current format and can't be restored.");
    const rev = await newRevision(tx, id, data, actor, `Restored from v${old.version}`);
    await tx.article.update({ where: { id }, data: { draftRevisionId: rev.id, status: "DRAFT", reviewRequestedBy: null } });
    await audit(tx, "ARTICLE_RESTORED", actor, `/guides/${a.slug}`, { from: old.version, to: rev.version });
  });
}

/** Change a guide's address. If it was ever public, the old address redirects permanently to the new one. */
export async function renameSlug(id: string, slug: string, actor: string) {
  const sp = slugProblem(slug);
  if (sp) throw new CmsRule(sp);
  return prisma.$transaction(async (tx) => {
    const a = await tx.article.findUniqueOrThrow({ where: { id } });
    if (a.slug === slug) return;
    if (await tx.article.findUnique({ where: { slug } })) throw new CmsRule("A guide already uses that address.");
    await tx.article.update({ where: { id }, data: { slug } });
    if (a.publishedAt) {
      const from = `/guides/${a.slug}`;
      const to = `/guides/${slug}`;
      // Re-point any redirect that pointed at the old address, so there are no chains.
      await tx.redirect.updateMany({ where: { toPath: from }, data: { toPath: to } });
      await tx.redirect.deleteMany({ where: { fromPath: to } });
      await tx.redirect.upsert({ where: { fromPath: from }, update: { toPath: to }, create: { fromPath: from, toPath: to, createdBy: actor } });
    }
    await audit(tx, "ARTICLE_RENAMED", actor, `/guides/${slug}`, { from: a.slug });
  });
}

// ---------- Public reads ----------

export type PublishedArticle = { id: string; slug: string; data: ArticleData; publishedAt: Date; updatedAt: Date };

const isLive = (a: { liveRevisionId: string | null; publishAt: Date | null }, now = new Date()) => Boolean(a.liveRevisionId) && (!a.publishAt || a.publishAt <= now);

export const publishedArticles = cache(async (): Promise<PublishedArticle[]> => {
  const rows = await prisma.article.findMany({ where: { liveRevisionId: { not: null } }, orderBy: { publishedAt: "desc" } });
  const live = rows.filter((r) => isLive(r));
  const revs = await prisma.articleRevision.findMany({ where: { id: { in: live.map((r) => r.liveRevisionId!) } } });
  return live
    .map((r) => {
      const rev = revs.find((x) => x.id === r.liveRevisionId);
      const data = rev ? parse(rev.data) : null;
      return data ? { id: r.id, slug: r.slug, data, publishedAt: r.publishAt ?? r.publishedAt ?? r.createdAt, updatedAt: rev!.createdAt } : null;
    })
    .filter((x): x is PublishedArticle => x !== null);
});

export async function publishedArticle(slug: string): Promise<PublishedArticle | null> {
  return (await publishedArticles()).find((a) => a.slug === slug) ?? null;
}
