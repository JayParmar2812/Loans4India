import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/db";
import { resetRateLimits } from "@/shared/security/request.server";
import { emptyArticle, articleProblems, type ArticleData } from "@/features/cms/domain/article";
import { approveAndPublish, CmsRule, createArticle, publishedArticle, renameSlug, requestReview, saveDraft, unpublish } from "@/features/cms/server/articles.server";
import { createsLoop, redirectPathProblem } from "@/features/cms/server/redirects.server";
import { createGuide, guideWorkflow, saveGuideDraft } from "@/features/cms/actions/content.actions";
import { POST as supportPost } from "@/app/api/support/route";
import { newBrowser, req } from "../support/context";
import { actAs, createStaff, form, redirectOf } from "../support/staff";
import { signInApplicant } from "../support/flows";

beforeEach(() => {
  resetRateLimits();
  newBrowser();
});

const guide = (title: string, text: string): ArticleData => ({
  ...emptyArticle(title),
  excerpt: "A plain-language explainer used in the tests for the guides workflow.",
  blocks: [{ type: "heading", text: "Section" }, { type: "text", text }],
});

describe("guides workflow (draft → review → four-eyes publish)", () => {
  it("live content changes only when someone other than the author approves", async () => {
    const a = await createArticle("emi-basics", guide("EMI basics explained", "Version one text."), "staff:writer");
    await requestReview(a.id, "staff:writer");
    await expect(approveAndPublish(a.id, "staff:writer", null)).rejects.toBeInstanceOf(CmsRule);
    await approveAndPublish(a.id, "staff:compliance", null);
    expect((await publishedArticle("emi-basics"))?.data.blocks[1]).toEqual({ type: "text", text: "Version one text." });

    // Editing the draft leaves the public page untouched until the next approval.
    await saveDraft(a.id, guide("EMI basics explained", "Version two text."), "edit", "staff:writer");
    expect((await publishedArticle("emi-basics"))?.data.blocks[1]).toEqual({ type: "text", text: "Version one text." });
    await requestReview(a.id, "staff:writer");
    await approveAndPublish(a.id, "staff:compliance", null);
    expect((await publishedArticle("emi-basics"))?.data.blocks[1]).toEqual({ type: "text", text: "Version two text." });

    await unpublish(a.id, "staff:compliance");
    expect(await publishedArticle("emi-basics")).toBeNull();
  });

  it("a scheduled guide isn't public before its time", async () => {
    const a = await createArticle("kfs-explained", guide("Reading a Key Fact Statement", "Text."), "staff:writer");
    await requestReview(a.id, "staff:writer");
    await approveAndPublish(a.id, "staff:compliance", new Date(Date.now() + 3600e3));
    expect(await publishedArticle("kfs-explained")).toBeNull();
  });

  it("refuses approval promises, off-site canonicals and script injection is inert", () => {
    expect(articleProblems(guide("Get pre-approved today", "Text"), "save").problems[0]).toMatch(/pre-approved/);
    const bad = { ...guide("Canonical test guide", "Text"), seo: { ...emptyArticle().seo, canonical: "https://evil.example/x" } };
    expect(articleProblems(bad, "save").data).toBeNull();
    // Text with markup is valid content but is always rendered as text (BlockList never uses raw HTML).
    expect(articleProblems(guide("Markup test guide", "<script>alert(1)</script>"), "save").problems).toEqual([]);
  });

  it("renaming a published guide redirects the old address", async () => {
    const a = await createArticle("old-name-guide", guide("A guide to rename", "Text."), "staff:writer");
    await requestReview(a.id, "staff:writer");
    await approveAndPublish(a.id, "staff:compliance", null);
    await renameSlug(a.id, "new-name-guide", "staff:compliance");
    expect((await prisma.redirect.findUnique({ where: { fromPath: "/guides/old-name-guide" } }))?.toPath).toBe("/guides/new-name-guide");
  });

  it("server actions enforce who may edit and who may publish", async () => {
    await createStaff("writer1", "CONTENT_EDITOR");
    await createStaff("comp1", "COMPLIANCE");
    await createStaff("exec9", "OPS_EXECUTIVE");
    await actAs("exec9");
    expect((await createGuide(null, form({ title: "Not allowed here", slug: "not-allowed" })))?.ok).toBe(false);
    await actAs("writer1");
    const to = await redirectOf(createGuide(null, form({ title: "Documents you need", slug: "documents-you-need" })));
    const id = to!.split("/").pop()!;
    expect((await saveGuideDraft(id, JSON.stringify(guide("Documents you need", "Keep PAN ready.")), "first"))?.ok).toBe(true);
    expect((await guideWorkflow(null, form({ id, decision: "submit" })))?.ok).toBe(true);
    expect((await guideWorkflow(null, form({ id, decision: "publish" })))?.message).toMatch(/Only Compliance/);
    await actAs("comp1");
    expect((await guideWorkflow(null, form({ id, decision: "publish" })))?.ok).toBe(true);
    expect(await prisma.adminEvent.count({ where: { type: "ARTICLE_PUBLISHED", actor: "staff:comp1" } })).toBe(1);
  });
});

describe("redirect safety", () => {
  it("only same-site paths, no private areas, no loops", async () => {
    expect(redirectPathProblem("https://evil.example", "to")).not.toBeNull();
    expect(redirectPathProblem("//evil.example", "to")).not.toBeNull();
    expect(redirectPathProblem("/admin", "from")).not.toBeNull();
    expect(redirectPathProblem("/old-page", "from")).toBeNull();
    await prisma.redirect.create({ data: { fromPath: "/a-page", toPath: "/b-page", createdBy: "t" } });
    expect(await createsLoop("/b-page", "/a-page")).toBe(true);
    expect(await createsLoop("/c-page", "/a-page")).toBe(false);
  });
});

describe("support and data-rights tickets (v4 §41)", () => {
  const body = (type: string, mobile: string) => ({ type, name: "Test Person", mobile, message: "Please help me with my application status." });

  it("anyone can raise a question; a data request needs the mobile proved by OTP", async () => {
    let r = await supportPost(req("/api/support", { json: body("QUERY", "9876700001") }) as never);
    expect(r.status).toBe(201);
    r = await supportPost(req("/api/support", { json: body("DATA_ACCESS", "9876700002") }) as never);
    expect(r.status).toBe(401);
    await signInApplicant("9876700002");
    r = await supportPost(req("/api/support", { json: body("DATA_ACCESS", "9876700002") }) as never);
    expect(r.status).toBe(201);
    const t = await prisma.supportTicket.findFirstOrThrow({ where: { mobile: "9876700002" } });
    expect(t.verified).toBe(true);
    expect(t.reference).toMatch(/^TKT-/);
    // Due in 7 days for data access.
    expect(Math.round((t.dueAt.getTime() - t.createdAt.getTime()) / 864e5)).toBe(7);
  });

  it("validates input", async () => {
    const r = await supportPost(req("/api/support", { json: { ...body("QUERY", "123"), message: "short" } }) as never);
    expect(r.status).toBe(422);
  });
});
