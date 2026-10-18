"use client";
import { useState } from "react";

/** One-tap marketing preference for this application (service messages are unaffected). */
export function MarketingPreference({ appKey, initial }: { appKey: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/documents/${appKey}/preferences`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketing: !on }) });
      const d = await res.json();
      if (d.ok) {
        setOn(d.marketing);
        setMsg(d.marketing ? "You'll get occasional tips and loan information." : "Done. No more marketing messages.");
      } else setMsg(d.error ?? "That didn't work. Please try again.");
    } catch {
      setMsg("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 rounded-2xl border border-line bg-white p-5 text-sm space-y-2" aria-labelledby="mk-h">
      <h2 id="mk-h" className="font-bold text-base">Messages</h2>
      <p className="text-muted">Updates about this application always reach you. Tips and loan information are optional.</p>
      <label className="flex items-center gap-3 font-semibold cursor-pointer">
        <input type="checkbox" className="size-5" checked={on} disabled={busy} onChange={toggle} />
        Send me tips and relevant loan information
      </label>
      {msg && <p role="status" className="text-mint-deep">{msg}</p>}
    </section>
  );
}
