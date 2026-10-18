"use client";
import { useEffect } from "react";

/** Remembers the first page, UTM params and referral code of this visit, so the application can be attributed. */
export function AttributionTracker() {
  useEffect(() => {
    try {
      const ss = window.sessionStorage;
      if (!ss.getItem("lfi_landing")) ss.setItem("lfi_landing", window.location.pathname);
      const q = new URLSearchParams(window.location.search);
      for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
        const v = q.get(k);
        if (v && !ss.getItem(`lfi_${k}`)) ss.setItem(`lfi_${k}`, v);
      }
      // Referral / affiliate code (section 1). Kept in the session, never in later URLs.
      const ref = q.get("ref");
      if (ref && /^[A-Za-z0-9_-]{1,40}$/.test(ref) && !ss.getItem("lfi_ref")) ss.setItem("lfi_ref", ref);
    } catch { /* ignore */ }
  }, []);
  return null;
}
