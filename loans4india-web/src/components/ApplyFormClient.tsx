"use client";
import dynamic from "next/dynamic";

// Client-only so the form can read the quick-estimate prefill without a hydration mismatch.
export const ApplyFormClient = dynamic(() => import("./ApplyForm").then((m) => m.ApplyForm), {
  ssr: false,
  loading: () => <div className="h-[520px] rounded-3xl border border-line bg-surface animate-pulse" aria-label="Loading form" />,
});
