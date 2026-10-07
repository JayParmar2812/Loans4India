"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bannedPhrases, BLOCK_TYPES, HEADING_FONTS, HOME_SECTION_LABELS, themeProblems, type Block, type BlockType, type HomeSection, type ProductSiteContent, type SiteContent, type SitePage, type SiteTheme } from "@/config/siteContent";
import { deleteSiteImage, restoreSiteContent, saveSiteContent, uploadSiteImage, type SiteResult } from "@/app/admin/site/actions";

type Version = { id: number; note: string | null; createdBy: string; createdAt: string; live: boolean };
type Image = { id: string; name: string; alt: string };

/** The master admin's editor for the public site. Nothing changes on the site until Save. */
export function SiteEditor({ initial, versions, images: initialImages }: { initial: SiteContent; versions: Version[]; images: Image[] }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [c, setC] = useState(initial);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<SiteResult | null>(null);
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(c) !== JSON.stringify(saved), [c, saved]);
  const banned = useMemo(() => bannedPhrases(c), [c]);
  const look = useMemo(() => themeProblems(c.theme), [c.theme]);
  const [images, setImages] = useState(initialImages);

  const set = <K extends keyof SiteContent>(k: K, v: SiteContent[K]) => setC((s) => ({ ...s, [k]: v }));
  const setHome = <K extends keyof SiteContent["home"]>(k: K, v: SiteContent["home"][K]) => setC((s) => ({ ...s, home: { ...s.home, [k]: v } }));
  const setProduct = (p: "PERSONAL_LOAN" | "BUSINESS_LOAN", v: ProductSiteContent) => setC((s) => ({ ...s, products: { ...s.products, [p]: v } }));

  function save() {
    start(async () => {
      const r = await saveSiteContent(JSON.stringify(c), note);
      setResult(r);
      if (r.ok) {
        setSaved(c);
        setNote("");
        router.refresh();
      }
    });
  }
  function restore(id: number) {
    if (dirty && !window.confirm("You have unsaved changes. Restoring will throw them away. Continue?")) return;
    if (!dirty && !window.confirm(id === 0 ? "Put the original site back live?" : `Put version ${id} back live?`)) return;
    start(async () => {
      const r = await restoreSiteContent(id);
      setResult(r);
      if (r.ok) window.location.reload();
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <Panel title="Switches" open>
        <Toggle label="Taking new applications" checked={c.applications.open} onChange={(v) => set("applications", { ...c.applications, open: v })} />
        {!c.applications.open && (
          <Text label="What people see on the apply page while paused" multiline value={c.applications.pausedMessage} onChange={(v) => set("applications", { ...c.applications, pausedMessage: v })} />
        )}
        <Toggle label="Personal Loan (page, menu links, and new applications)" checked={c.products.PERSONAL_LOAN.enabled} onChange={(v) => setProduct("PERSONAL_LOAN", { ...c.products.PERSONAL_LOAN, enabled: v })} />
        <Toggle label="Business Loan (page, menu links, and new applications)" checked={c.products.BUSINESS_LOAN.enabled} onChange={(v) => setProduct("BUSINESS_LOAN", { ...c.products.BUSINESS_LOAN, enabled: v })} />
        <Toggle label="EMI calculator page" checked={c.tools.emiCalculator} onChange={(v) => set("tools", { emiCalculator: v })} />
        <p className="text-xs text-muted">People who already applied are never affected: their link, documents and tracker keep working.</p>
      </Panel>

      <Panel title="Announcement banner">
        <Toggle label="Show a banner above the menu on every page" checked={c.banner.show} onChange={(v) => set("banner", { ...c.banner, show: v })} />
        <Text label="Banner text" value={c.banner.text} onChange={(v) => set("banner", { ...c.banner, text: v })} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Text label="Link text (optional)" value={c.banner.linkLabel} onChange={(v) => set("banner", { ...c.banner, linkLabel: v })} />
          <Text label="Link address (optional)" placeholder="/apply" value={c.banner.linkHref} onChange={(v) => set("banner", { ...c.banner, linkHref: v })} />
        </div>
      </Panel>

      <Panel title="Menu">
        <LinkList items={c.nav} onChange={(v) => set("nav", v)} max={8} />
        <p className="text-xs text-muted">Links to a page that is switched off are hidden automatically.</p>
      </Panel>

      <Panel title="Home page: top">
        <Text label="Small label above the headline" value={c.home.hero.eyebrow} onChange={(v) => setHome("hero", { ...c.home.hero, eyebrow: v })} />
        <Text label="Headline" multiline hint="Each line shows as its own line. Put *stars* round words to highlight them in green." value={c.home.hero.headline} onChange={(v) => setHome("hero", { ...c.home.hero, headline: v })} />
        <Text label="Hindi line (optional)" value={c.home.hero.subHi} onChange={(v) => setHome("hero", { ...c.home.hero, subHi: v })} />
        <Text label="Intro" multiline value={c.home.hero.sub} onChange={(v) => setHome("hero", { ...c.home.hero, sub: v })} />
        <ImagePicker label="Background photo (optional, tinted with the main colour)" images={images} value={c.home.hero.image} onChange={(v) => setHome("hero", { ...c.home.hero, image: v })} />
        <Label>Ticks under the intro</Label>
        <StringList items={c.home.hero.badges} onChange={(v) => setHome("hero", { ...c.home.hero, badges: v })} max={6} addLabel="Add a tick" />
        <p className="text-xs text-muted">The estimate box on the right, with its &quot;not a lender&quot; line, is fixed.</p>
      </Panel>

      <Panel title="Home page: sections and their order">
        <p className="text-sm text-muted">Use the arrows to change the order. Untick a section to hide it.</p>
        <List
          items={c.home.order}
          onChange={(v) => setHome("order", v)}
          render={(s: HomeSection) => (
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={c.home[s].show} onChange={(e) => setHome(s, { ...c.home[s], show: e.target.checked } as never)} />
              {HOME_SECTION_LABELS[s]}
            </label>
          )}
        />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.how}`}>
        <Text label="Heading" value={c.home.how.heading} onChange={(v) => setHome("how", { ...c.home.how, heading: v })} />
        <ItemList items={c.home.how.items} onChange={(v) => setHome("how", { ...c.home.how, items: v })} max={8} addLabel="Add a step" />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.products}`}>
        <List
          items={c.home.products.cards}
          onChange={(v) => setHome("products", { ...c.home.products, cards: v })}
          max={4}
          addLabel="Add a card"
          make={() => ({ title: "", href: "/apply", range: "", points: [] })}
          render={(card, setCard) => (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-3 gap-2">
                <Text label="Title" value={card.title} onChange={(v) => setCard({ ...card, title: v })} />
                <Text label="Amount range" value={card.range} onChange={(v) => setCard({ ...card, range: v })} />
                <Text label="Opens" value={card.href} onChange={(v) => setCard({ ...card, href: v })} />
              </div>
              <StringList items={card.points} onChange={(v) => setCard({ ...card, points: v })} max={6} addLabel="Add a point" />
            </div>
          )}
        />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.uses}`}>
        <Text label="Heading" value={c.home.uses.heading} onChange={(v) => setHome("uses", { ...c.home.uses, heading: v })} />
        <StringList items={c.home.uses.items} onChange={(v) => setHome("uses", { ...c.home.uses, items: v })} max={16} addLabel="Add a reason" />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.why}`}>
        <Text label="Heading" value={c.home.why.heading} onChange={(v) => setHome("why", { ...c.home.why, heading: v })} />
        <ItemList items={c.home.why.items} onChange={(v) => setHome("why", { ...c.home.why, items: v })} max={8} addLabel="Add a point" />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.emi}`}>
        <Text label="Heading" value={c.home.emi.heading} onChange={(v) => setHome("emi", { ...c.home.emi, heading: v })} />
        <Text label="Text" value={c.home.emi.text} onChange={(v) => setHome("emi", { ...c.home.emi, text: v })} />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.faq}`}>
        <Text label="Heading" value={c.home.faq.heading} onChange={(v) => setHome("faq", { ...c.home.faq, heading: v })} />
        <FaqList items={c.home.faq.items} onChange={(v) => setHome("faq", { ...c.home.faq, items: v })} />
      </Panel>

      <Panel title={`Home: ${HOME_SECTION_LABELS.cta}`}>
        <div className="grid sm:grid-cols-3 gap-3">
          <Text label="Heading" value={c.home.cta.heading} onChange={(v) => setHome("cta", { ...c.home.cta, heading: v })} />
          <Text label="Text" value={c.home.cta.text} onChange={(v) => setHome("cta", { ...c.home.cta, text: v })} />
          <Text label="Button" value={c.home.cta.button} onChange={(v) => setHome("cta", { ...c.home.cta, button: v })} />
        </div>
      </Panel>

      <ProductPanel title="Personal Loan page" value={c.products.PERSONAL_LOAN} onChange={(v) => setProduct("PERSONAL_LOAN", v)} />
      <ProductPanel title="Business Loan page" value={c.products.BUSINESS_LOAN} onChange={(v) => setProduct("BUSINESS_LOAN", v)} />

      <Panel title="Footer">
        <List
          items={c.footer.columns}
          onChange={(v) => set("footer", { columns: v })}
          max={4}
          addLabel="Add a column"
          make={() => ({ title: "", links: [] })}
          render={(col, setCol) => (
            <div className="space-y-2">
              <Text label="Column title" value={col.title} onChange={(v) => setCol({ ...col, title: v })} />
              <LinkList items={col.links} onChange={(v) => setCol({ ...col, links: v })} max={10} />
            </div>
          )}
        />
        <p className="text-xs text-muted">The &quot;Important: not a lender&quot; notice, grievance officer and copyright under the columns are fixed.</p>
      </Panel>

      <Panel title="Pages">
        <p className="text-sm text-muted">Build extra pages from blocks. A draft is only visible to you through Preview (after saving). To link a page, add <code>/its-address</code> to the menu or footer.</p>
        <List
          items={c.pages}
          onChange={(v) => set("pages", v)}
          max={30}
          addLabel="Add a page"
          make={(): SitePage => ({ slug: `new-page-${c.pages.length + 1}`, title: "New page", metaDescription: "", published: false, blocks: [{ type: "text", text: "Write here." }] })}
          render={(page, setPage) => <PageEditor page={page} onChange={setPage} images={images} saved={saved.pages.some((p) => p.slug === page.slug)} />}
        />
      </Panel>

      <Panel title="Images">
        <ImageLibrary images={images} onAdd={(img) => setImages((l) => [img, ...l])} onRemove={(id) => setImages((l) => l.filter((i) => i.id !== id))} />
      </Panel>

      <Panel title="Look: colours, heading font, logo">
        <ThemeEditor theme={c.theme} onChange={(v) => set("theme", v)} problems={look} />
      </Panel>

      <Panel title="History">
        <ul className="divide-y divide-line text-sm">
          {versions.map((v) => (
            <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Version {v.id}</strong> · {new Date(v.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {v.createdBy.replace(/^staff:/, "")}
                {v.note && <span className="text-muted"> · {v.note}</span>}
                {v.live && <span className="ml-2 rounded-full bg-mint/30 px-2 py-0.5 text-xs">live</span>}
              </span>
              {!v.live && <button type="button" className="btn-ghost !py-1 !px-3 text-sm" disabled={pending} onClick={() => restore(v.id)}>Restore</button>}
            </li>
          ))}
          <li className="py-2 flex flex-wrap items-center justify-between gap-2">
            <span><strong>Original site</strong> <span className="text-muted">· as it was built</span></span>
            <button type="button" className="btn-ghost !py-1 !px-3 text-sm" disabled={pending} onClick={() => restore(0)}>Restore</button>
          </li>
        </ul>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className={`text-sm font-semibold ${dirty ? "text-violet" : "text-muted"}`}>{dirty ? "Unsaved changes" : "No unsaved changes"}</span>
          <input className="field-input !py-2 flex-1 min-w-48" placeholder="What changed? (optional, shows in History)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn-ghost !py-2" disabled={!dirty || pending} onClick={() => { setC(saved); setResult(null); }}>Discard</button>
          <button type="button" className="btn-primary !py-2" disabled={!dirty || pending || banned.length > 0 || look.length > 0} onClick={save}>{pending ? "Saving…" : "Save and publish"}</button>
          <a href="/" target="_blank" rel="noreferrer" className="text-sm text-violet underline">View site</a>
          {banned.length > 0 && <p role="alert" className="w-full text-sm text-danger">The site can&apos;t say &quot;{banned.join('", "')}&quot;. An estimate is never an approval, and only the bank decides.</p>}
          {look.length > 0 && <p role="alert" className="w-full text-sm text-danger">Look: {look[0]}.</p>}
          {result && <p role="status" className={`w-full text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p>}
        </div>
      </div>
    </div>
  );
}

function ProductPanel({ title, value: p, onChange }: { title: string; value: ProductSiteContent; onChange: (v: ProductSiteContent) => void }) {
  return (
    <Panel title={title}>
      {!p.enabled && <p className="text-sm rounded-xl bg-violet-soft px-3 py-2">This page is switched off. You can still edit it; it shows again when you switch it on.</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        <Text label="Small label" value={p.eyebrow} onChange={(v) => onChange({ ...p, eyebrow: v })} />
        <Text label="Title" value={p.title} onChange={(v) => onChange({ ...p, title: v })} />
      </div>
      <Text label="Intro" multiline value={p.intro} onChange={(v) => onChange({ ...p, intro: v })} />
      <Label>Highlights</Label>
      <List
        items={p.highlights}
        onChange={(v) => onChange({ ...p, highlights: v })}
        max={8}
        addLabel="Add a highlight"
        make={() => ({ k: "", v: "" })}
        render={(h, setH) => (
          <div className="grid grid-cols-2 gap-2">
            <Text label="Name" value={h.k} onChange={(v) => setH({ ...h, k: v })} />
            <Text label="Value" value={h.v} onChange={(v) => setH({ ...h, v })} />
          </div>
        )}
      />
      <Label>Who can apply</Label>
      <StringList items={p.whoCanApply} onChange={(v) => onChange({ ...p, whoCanApply: v })} max={12} addLabel="Add a line" />
      <Label>Documents to keep ready</Label>
      <StringList items={p.documents} onChange={(v) => onChange({ ...p, documents: v })} max={12} addLabel="Add a document" />
      <p className="text-xs text-muted">This list is only what the page says. The checklist applicants upload against is set separately.</p>
      <Label>Questions</Label>
      <FaqList items={p.faq} onChange={(v) => onChange({ ...p, faq: v })} />
      <div className="grid sm:grid-cols-2 gap-3">
        <Text label="Search result title" value={p.metaTitle} onChange={(v) => onChange({ ...p, metaTitle: v })} />
        <Text label="Search result description" multiline value={p.metaDescription} onChange={(v) => onChange({ ...p, metaDescription: v })} />
      </div>
    </Panel>
  );
}

export function Panel({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-2xl border border-line bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 font-semibold text-lg flex items-center justify-between">
        {title}
        <span aria-hidden className="text-violet text-xl transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="px-5 pb-5 space-y-3">{children}</div>
    </details>
  );
}

const Label = ({ children }: { children: React.ReactNode }) => <p className="field-label !mb-0">{children}</p>;

export function Text({ label, value, onChange, multiline, hint, placeholder }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {multiline ? (
        <textarea className="field-input min-h-20" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="field-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <input type="checkbox" className="size-5 accent-violet" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
      <span className={`text-xs rounded-full px-2 py-0.5 ${checked ? "bg-mint/30" : "bg-line"}`}>{checked ? "On" : "Off"}</span>
    </label>
  );
}

/** A list with move up, move down and remove on every row, and an add button when `make` is given. */
export function List<T>({ items, onChange, render, make, max = 50, addLabel = "Add" }: { items: T[]; onChange: (v: T[]) => void; render: (item: T, set: (v: T) => void, i: number) => React.ReactNode; make?: () => T; max?: number; addLabel?: string }) {
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start rounded-xl border border-line p-3 bg-canvas">
          <div className="flex-1 min-w-0">{render(item, (v) => onChange(items.map((x, j) => (j === i ? v : x))), i)}</div>
          <div className="flex gap-1 shrink-0">
            <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</IconButton>
            <IconButton label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</IconButton>
            {make && <IconButton label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</IconButton>}
          </div>
        </div>
      ))}
      {make && items.length < max && (
        <button type="button" className="text-sm text-violet font-semibold underline" onClick={() => onChange([...items, make()])}>+ {addLabel}</button>
      )}
    </div>
  );
}

export function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="size-8 rounded-lg border border-line bg-white text-sm disabled:opacity-30 hover:border-violet">
      {children}
    </button>
  );
}

function StringList({ items, onChange, max, addLabel }: { items: string[]; onChange: (v: string[]) => void; max: number; addLabel: string }) {
  return <List items={items} onChange={onChange} max={max} addLabel={addLabel} make={() => ""} render={(s, setS) => <input className="field-input !py-2" value={s} onChange={(e) => setS(e.target.value)} />} />;
}

function LinkList({ items, onChange, max }: { items: { label: string; href: string }[]; onChange: (v: { label: string; href: string }[]) => void; max: number }) {
  return (
    <List
      items={items}
      onChange={onChange}
      max={max}
      addLabel="Add a link"
      make={() => ({ label: "", href: "/" })}
      render={(l, setL) => (
        <div className="grid grid-cols-2 gap-2">
          <input className="field-input !py-2" aria-label="Link text" placeholder="Link text" value={l.label} onChange={(e) => setL({ ...l, label: e.target.value })} />
          <input className="field-input !py-2" aria-label="Link address" placeholder="/page or https://…" value={l.href} onChange={(e) => setL({ ...l, href: e.target.value })} />
        </div>
      )}
    />
  );
}

function ItemList({ items, onChange, max, addLabel }: { items: { title: string; text: string }[]; onChange: (v: { title: string; text: string }[]) => void; max: number; addLabel: string }) {
  return (
    <List
      items={items}
      onChange={onChange}
      max={max}
      addLabel={addLabel}
      make={() => ({ title: "", text: "" })}
      render={(it, setIt) => (
        <div className="space-y-2">
          <input className="field-input !py-2 font-semibold" aria-label="Title" placeholder="Title" value={it.title} onChange={(e) => setIt({ ...it, title: e.target.value })} />
          <textarea className="field-input !py-2" aria-label="Text" placeholder="Text" value={it.text} onChange={(e) => setIt({ ...it, text: e.target.value })} />
        </div>
      )}
    />
  );
}

function FaqList({ items, onChange }: { items: { q: string; a: string }[]; onChange: (v: { q: string; a: string }[]) => void }) {
  return (
    <List
      items={items}
      onChange={onChange}
      max={20}
      addLabel="Add a question"
      make={() => ({ q: "", a: "" })}
      render={(f, setF) => (
        <div className="space-y-2">
          <input className="field-input !py-2 font-semibold" aria-label="Question" placeholder="Question" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          <textarea className="field-input !py-2 min-h-20" aria-label="Answer" placeholder="Answer" value={f.a} onChange={(e) => setF({ ...f, a: e.target.value })} />
        </div>
      )}
    />
  );
}

function ImagePicker({ label, images, value, onChange }: { label: string; images: Image[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block flex-1 min-w-56">
        <span className="field-label">{label}</span>
        <select className="field-input" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">No image</option>
          {value && !images.some((i) => i.id === value) && <option value={value}>(removed image)</option>}
          {images.map((i) => <option key={i.id} value={i.id}>{i.name}{i.alt ? ` · ${i.alt}` : ""}</option>)}
        </select>
      </label>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value && <img src={`/site-assets/${value}`} alt="" className="h-16 w-24 object-cover rounded-lg border border-line" />}
    </div>
  );
}

function ImageLibrary({ images, onAdd, onRemove }: { images: Image[]; onAdd: (i: Image) => void; onRemove: (id: string) => void }) {
  const [msg, setMsg] = useState<SiteResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          start(async () => {
            const r = await uploadSiteImage(fd);
            setMsg(r);
            if (r.ok && r.image) {
              onAdd(r.image);
              form.reset();
            }
          });
        }}
      >
        <label className="block"><span className="field-label">Image (JPG, PNG or WebP, up to 2 MB)</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp" className="field-input !py-2" required /></label>
        <label className="block flex-1 min-w-48"><span className="field-label">What it shows (for people who can&apos;t see it)</span><input name="alt" className="field-input" maxLength={200} /></label>
        <button className="btn-primary !py-2" disabled={pending}>{pending ? "Uploading…" : "Upload"}</button>
      </form>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.message}</p>}
      {images.length === 0 ? (
        <p className="text-sm text-muted">No images yet.</p>
      ) : (
        <ul className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {images.map((i) => (
            <li key={i.id} className="rounded-xl border border-line bg-canvas p-2 text-xs space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/site-assets/${i.id}`} alt={i.alt} className="h-24 w-full object-cover rounded-lg" />
              <p className="font-semibold truncate" title={i.name}>{i.name}</p>
              {i.alt && <p className="text-muted truncate" title={i.alt}>{i.alt}</p>}
              <button
                type="button"
                className="text-danger underline"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm(`Remove ${i.name} from the library?`)) return;
                  start(async () => {
                    const r = await deleteSiteImage(i.id);
                    setMsg(r);
                    if (r.ok) onRemove(i.id);
                  });
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const NEW_BLOCK: Record<BlockType, () => Block> = {
  heading: () => ({ type: "heading", text: "" }),
  text: () => ({ type: "text", text: "" }),
  image: () => ({ type: "image", asset: "", alt: "", caption: "" }),
  list: () => ({ type: "list", items: [""] }),
  faq: () => ({ type: "faq", items: [{ q: "", a: "" }] }),
  cta: () => ({ type: "cta", heading: "Ready to start?", text: "", button: "Start your application", href: "/apply" }),
  emi: () => ({ type: "emi" }),
};

function PageEditor({ page, onChange, images, saved }: { page: SitePage; onChange: (p: SitePage) => void; images: Image[]; saved: boolean }) {
  const [adding, setAdding] = useState<BlockType>("text");
  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <Text label="Address" hint={`The page opens at /${page.slug || "…"}`} value={page.slug} onChange={(v) => onChange({ ...page, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
        <Text label="Title" value={page.title} onChange={(v) => onChange({ ...page, title: v })} />
      </div>
      <Text label="Search result description" value={page.metaDescription} onChange={(v) => onChange({ ...page, metaDescription: v })} />
      <div className="flex flex-wrap items-center gap-4">
        <Toggle label="Published on the public site" checked={page.published} onChange={(v) => onChange({ ...page, published: v })} />
        {saved ? (
          <>
            <a className="text-sm text-violet underline" href={`/admin/site/preview/${page.slug}`} target="_blank" rel="noreferrer">Preview (saved version)</a>
            {page.published && <a className="text-sm text-violet underline" href={`/${page.slug}`} target="_blank" rel="noreferrer">View</a>}
          </>
        ) : (
          <span className="text-xs text-muted">Save to preview this page.</span>
        )}
      </div>
      <Label>Blocks</Label>
      <List
        items={page.blocks}
        onChange={(v) => onChange({ ...page, blocks: v })}
        max={40}
        make={() => NEW_BLOCK[adding]()}
        addLabel={`Add a ${BLOCK_TYPES[adding].toLowerCase()} block`}
        render={(b, setB) => (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet">{BLOCK_TYPES[b.type]}</p>
            <BlockEditor block={b} onChange={setB} images={images} />
          </div>
        )}
      />
      <label className="flex items-center gap-2 text-sm">
        Next block to add:
        <select className="field-input !py-1 !w-auto" value={adding} onChange={(e) => setAdding(e.target.value as BlockType)}>
          {Object.entries(BLOCK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
    </div>
  );
}

function BlockEditor({ block: b, onChange, images }: { block: Block; onChange: (b: Block) => void; images: Image[] }) {
  switch (b.type) {
    case "heading":
      return <input className="field-input !py-2 font-semibold" aria-label="Heading" value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "text":
      return <textarea className="field-input min-h-28" aria-label="Text" placeholder="Leave an empty line between paragraphs." value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />;
    case "image":
      return (
        <div className="space-y-2">
          <ImagePicker label="Image" images={images} value={b.asset} onChange={(v) => onChange({ ...b, asset: v, alt: b.alt || images.find((i) => i.id === v)?.alt || "" })} />
          <div className="grid sm:grid-cols-2 gap-2">
            <Text label="What it shows" value={b.alt} onChange={(v) => onChange({ ...b, alt: v })} />
            <Text label="Caption (optional)" value={b.caption} onChange={(v) => onChange({ ...b, caption: v })} />
          </div>
        </div>
      );
    case "list":
      return <StringList items={b.items} onChange={(v) => onChange({ ...b, items: v })} max={30} addLabel="Add a line" />;
    case "faq":
      return <FaqList items={b.items} onChange={(v) => onChange({ ...b, items: v })} />;
    case "cta":
      return (
        <div className="grid sm:grid-cols-2 gap-2">
          <Text label="Heading" value={b.heading} onChange={(v) => onChange({ ...b, heading: v })} />
          <Text label="Text" value={b.text} onChange={(v) => onChange({ ...b, text: v })} />
          <Text label="Button" value={b.button} onChange={(v) => onChange({ ...b, button: v })} />
          <Text label="Button opens" value={b.href} onChange={(v) => onChange({ ...b, href: v })} />
        </div>
      );
    case "emi":
      return <p className="text-sm text-muted">Shows the EMI calculator.</p>;
  }
}

function ThemeEditor({ theme: t, onChange, problems }: { theme: SiteTheme; onChange: (t: SiteTheme) => void; problems: string[] }) {
  const colours: [keyof SiteTheme, string][] = [["main", "Main colour"], ["dark", "Dark colour"], ["light", "Light tint"], ["accent", "Accent (buttons)"]];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-4 gap-3">
        {colours.map(([k, label]) => (
          <label key={k} className="block">
            <span className="field-label">{label}</span>
            <span className="flex gap-2">
              <input type="color" aria-label={`${label} picker`} className="h-10 w-12 rounded border border-line" value={t[k] as string} onChange={(e) => onChange({ ...t, [k]: e.target.value })} />
              <input className="field-input !py-2 font-mono" aria-label={label} value={t[k] as string} onChange={(e) => onChange({ ...t, [k]: e.target.value.trim() })} />
            </span>
          </label>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="field-label">Heading font</span>
          <select className="field-input" value={t.headingFont} onChange={(e) => onChange({ ...t, headingFont: e.target.value as SiteTheme["headingFont"] })}>
            {Object.entries(HEADING_FONTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <Text label="Logo text, first part" value={t.logo[0]} onChange={(v) => onChange({ ...t, logo: [v, t.logo[1]] })} />
        <Text label="Logo text, coloured part" value={t.logo[1]} onChange={(v) => onChange({ ...t, logo: [t.logo[0], v] })} />
      </div>
      <div className="rounded-2xl overflow-hidden border border-line text-sm" aria-label="Colour preview">
        <div className="px-4 py-3 text-white font-semibold" style={{ background: /^#[0-9a-f]{6}$/i.test(t.main) ? t.main : undefined }}>Top of the home page</div>
        <div className="px-4 py-3 font-semibold" style={{ background: t.light, color: t.dark }}>Tinted section heading</div>
        <div className="px-4 py-3 flex items-center gap-3 bg-white">
          <span className="rounded-lg px-3 py-1.5 font-semibold" style={{ background: t.accent, color: "#1a1240" }}>Button</span>
          <span style={{ color: t.main }} className="underline">A link</span>
        </div>
        <div className="px-4 py-3 text-white" style={{ background: t.dark }}>Footer</div>
      </div>
      {problems.length > 0 ? (
        <ul className="text-sm text-danger list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      ) : (
        <p className="text-sm text-success">All text on these colours is easy to read.</p>
      )}
      <p className="text-xs text-muted">The brand name in the &quot;not a lender&quot; notices and legal pages doesn&apos;t change with the logo text.</p>
    </div>
  );
}
