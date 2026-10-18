"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGuideDraft } from "@/features/cms/actions/content.actions";
import { ARTICLE_CATEGORIES, type ArticleCategory, type ArticleData } from "@/features/cms/domain/article";
import { BLOCK_TYPES, type Block, type BlockType } from "@/features/site-control/config/siteContent";
import { brand } from "@/shared/config/brand";

const blank = (t: BlockType): Block => {
  switch (t) {
    case "heading": return { type: "heading", text: "" };
    case "text": return { type: "text", text: "" };
    case "list": return { type: "list", items: [""] };
    case "faq": return { type: "faq", items: [{ q: "", a: "" }] };
    case "cta": return { type: "cta", heading: "Ready to apply?", text: "", button: "Start your application", href: "/apply" };
    case "image": return { type: "image", asset: "", alt: "", caption: "" };
    case "emi": return { type: "emi" };
  }
};

/** Structured editor for a guide's working draft. Saving never changes the live guide; approval does. */
export function ArticleEditor({ id, slug, initial, assets, guides, readOnly }: {
  id: string; slug: string; initial: ArticleData; assets: { id: string; name: string }[]; guides: { slug: string; title: string }[]; readOnly: boolean;
}) {
  const router = useRouter();
  const [d, setD] = useState<ArticleData>(initial);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const upd = (patch: Partial<ArticleData>) => { setD((x) => ({ ...x, ...patch })); setDirty(true); setMsg(null); };
  const updSeo = (patch: Partial<ArticleData["seo"]>) => upd({ seo: { ...d.seo, ...patch } });
  const setBlock = (i: number, b: Block) => upd({ blocks: d.blocks.map((x, j) => (j === i ? b : x)) });
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= d.blocks.length) return;
    const next = [...d.blocks];
    [next[i], next[j]] = [next[j], next[i]];
    upd({ blocks: next });
  };

  function save() {
    start(async () => {
      const r = await saveGuideDraft(id, JSON.stringify(d), note);
      setMsg({ ok: Boolean(r?.ok), text: r?.message ?? "" });
      if (r?.ok) { setDirty(false); setNote(""); router.refresh(); }
    });
  }

  const seoTitle = d.seo.title || d.title;
  const seoDesc = d.seo.description || d.excerpt;

  return (
    <fieldset disabled={readOnly || pending} className="space-y-6">
      <section className="card p-5 space-y-4">
        <h2 className="font-bold text-lg">Basics</h2>
        <Text label="Title" value={d.title} max={120} onChange={(v) => upd({ title: v })} />
        <Area label="Summary (shown in lists and as the default search description)" value={d.excerpt} max={300} rows={2} onChange={(v) => upd({ excerpt: v })} />
        <div className="grid sm:grid-cols-2 gap-4">
          <label><span className="field-label">Category</span>
            <select className="field-input" value={d.category} onChange={(e) => upd({ category: e.target.value as ArticleCategory })}>
              {Object.entries(ARTICLE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <Text label="Breadcrumb label (optional, short)" value={d.breadcrumb} max={40} onChange={(v) => upd({ breadcrumb: v })} />
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-bold text-lg">Content</h2>
        <p className="text-sm text-muted">Text is shown exactly as typed (no HTML). Leave a blank line between paragraphs. Never promise approval, a rate or a turnaround: the guard words (&quot;guaranteed&quot;, &quot;pre-approved&quot;, &quot;eligible&quot;…) block saving.</p>
        {d.blocks.map((b, i) => (
          <div key={i} className="rounded-xl border border-line p-4 space-y-3 bg-canvas">
            <div className="flex items-center justify-between gap-2">
              <span className="chip bg-violet-soft text-violet-deep">{BLOCK_TYPES[b.type]}</span>
              <div className="flex gap-1 text-sm">
                <button type="button" className="btn-quiet !min-h-0 !py-1" onClick={() => move(i, -1)} aria-label={`Move block ${i + 1} up`}>↑</button>
                <button type="button" className="btn-quiet !min-h-0 !py-1" onClick={() => move(i, 1)} aria-label={`Move block ${i + 1} down`}>↓</button>
                <button type="button" className="btn-quiet !min-h-0 !py-1 !text-danger" onClick={() => upd({ blocks: d.blocks.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            </div>
            <BlockFields b={b} onChange={(nb) => setBlock(i, nb)} assets={assets} />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(BLOCK_TYPES) as BlockType[]).map((t) => (
            <button key={t} type="button" className="btn-ghost !min-h-0 !py-1.5 text-sm" onClick={() => upd({ blocks: [...d.blocks, blank(t)] })}>+ {BLOCK_TYPES[t]}</button>
          ))}
        </div>
      </section>

      <section className="card p-5 space-y-4">
        <h2 className="font-bold text-lg">Search and sharing</h2>
        <div className="rounded-xl border border-line bg-white p-4 text-sm" aria-label="Search result preview">
          <p className="text-xs text-muted truncate">{brand.siteUrl}/guides/{slug}</p>
          <p className="text-[#1a0dab] text-lg leading-snug truncate">{seoTitle} | {brand.name}</p>
          <p className="text-muted line-clamp-2">{seoDesc}</p>
        </div>
        <Text label="Search title (optional; defaults to the title)" value={d.seo.title} max={70} onChange={(v) => updSeo({ title: v })} counter />
        <Area label="Search description (optional; defaults to the summary)" value={d.seo.description} max={160} rows={2} onChange={(v) => updSeo({ description: v })} counter />
        <div className="grid sm:grid-cols-2 gap-4">
          <Text label="Canonical address (optional, a path on this site)" value={d.seo.canonical} max={200} onChange={(v) => updSeo({ canonical: v })} placeholder={`/guides/${slug}`} />
          <label><span className="field-label">Social image</span>
            <select className="field-input" value={d.seo.image} onChange={(e) => updSeo({ image: e.target.value })}>
              <option value="">Site default</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        </div>
        {d.seo.image && <Text label="Describe the social image" value={d.seo.imageAlt} max={200} onChange={(v) => updSeo({ imageAlt: v })} />}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.seo.noindex} onChange={(e) => updSeo({ noindex: e.target.checked })} /> Hide from search engines (noindex) and from guide lists</label>
      </section>

      {guides.length > 0 && (
        <section className="card p-5 space-y-3">
          <h2 className="font-bold text-lg">Related guides</h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {guides.map((g) => (
              <label key={g.slug} className="flex items-center gap-2">
                <input type="checkbox" checked={d.related.includes(g.slug)} onChange={(e) => upd({ related: e.target.checked ? [...d.related, g.slug].slice(0, 6) : d.related.filter((s) => s !== g.slug) })} />
                {g.title}
              </label>
            ))}
          </div>
        </section>
      )}

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-1 rounded-2xl border border-line bg-white/95 backdrop-blur p-3 flex flex-wrap items-center gap-3 shadow-card">
          <input className="field-input !min-h-0 !py-2 flex-1 min-w-48" placeholder="What changed? (optional note for the history)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          <button type="button" className="btn-primary !py-2" onClick={save} disabled={pending || !dirty}>{pending ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
          {msg && <p role="status" className={`text-sm w-full ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
        </div>
      )}
    </fieldset>
  );
}

function BlockFields({ b, onChange, assets }: { b: Block; onChange: (b: Block) => void; assets: { id: string; name: string }[] }) {
  switch (b.type) {
    case "heading":
      return <Text label="Heading" value={b.text} max={120} onChange={(text) => onChange({ ...b, text })} />;
    case "text":
      return <Area label="Text" value={b.text} max={5000} rows={6} onChange={(text) => onChange({ ...b, text })} />;
    case "list":
      return <Area label="One item per line" value={b.items.join("\n")} max={9000} rows={4} onChange={(v) => onChange({ ...b, items: v.split("\n") })} />;
    case "faq":
      return (
        <div className="space-y-3">
          {b.items.map((it, i) => (
            <div key={i} className="grid gap-2 rounded-lg bg-white border border-line p-3">
              <Text label={`Question ${i + 1}`} value={it.q} max={200} onChange={(q) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, q } : x)) })} />
              <Area label="Answer" value={it.a} max={1500} rows={3} onChange={(a) => onChange({ ...b, items: b.items.map((x, j) => (j === i ? { ...x, a } : x)) })} />
              {b.items.length > 1 && <button type="button" className="btn-quiet !min-h-0 !py-1 text-sm justify-self-start !text-danger" onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) })}>Remove question</button>}
            </div>
          ))}
          <button type="button" className="btn-quiet !min-h-0 !py-1 text-sm" onClick={() => onChange({ ...b, items: [...b.items, { q: "", a: "" }] })}>+ Question</button>
        </div>
      );
    case "cta":
      return (
        <div className="grid sm:grid-cols-2 gap-3">
          <Text label="Heading" value={b.heading} max={80} onChange={(heading) => onChange({ ...b, heading })} />
          <Text label="Text" value={b.text} max={200} onChange={(text) => onChange({ ...b, text })} />
          <Text label="Button" value={b.button} max={40} onChange={(button) => onChange({ ...b, button })} />
          <Text label="Link (a page on this site, like /apply)" value={b.href} max={300} onChange={(href) => onChange({ ...b, href })} />
        </div>
      );
    case "image":
      return (
        <div className="grid sm:grid-cols-2 gap-3">
          <label><span className="field-label">Image (from the Website image library)</span>
            <select className="field-input" value={b.asset} onChange={(e) => onChange({ ...b, asset: e.target.value })}>
              <option value="">Pick an image</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <Text label="Describe the image (alt text)" value={b.alt} max={200} onChange={(alt) => onChange({ ...b, alt })} />
          <Text label="Caption (optional)" value={b.caption} max={200} onChange={(caption) => onChange({ ...b, caption })} />
        </div>
      );
    case "emi":
      return <p className="text-sm text-muted">Shows the EMI calculator here.</p>;
  }
}

function Text({ label, value, onChange, max, placeholder, counter }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; counter?: boolean }) {
  return (
    <label className="block">
      <span className="field-label flex justify-between">{label}{counter && <span className={`num font-normal ${value.length > max ? "text-danger" : "text-muted"}`}>{value.length}/{max}</span>}</span>
      <input className="field-input" value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Area({ label, value, onChange, max, rows, counter }: { label: string; value: string; onChange: (v: string) => void; max: number; rows: number; counter?: boolean }) {
  return (
    <label className="block">
      <span className="field-label flex justify-between">{label}{counter && <span className={`num font-normal ${value.length > max ? "text-danger" : "text-muted"}`}>{value.length}/{max}</span>}</span>
      <textarea className="field-input" rows={rows} value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
