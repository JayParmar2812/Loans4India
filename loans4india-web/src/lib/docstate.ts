import type { Slot } from "./documents";
import { checklistFor, type AppFlow } from "@/config/applicantFlow";

export type DocView = { id: string; slot: string; name: string; sizeBytes: number; status: string; rejectReason: string | null; rejectNote?: string | null; createdAt: string };

export type SlotView = Slot & {
  files: DocView[];
  /** missing | uploaded | accepted | needs_replacing */
  state: "missing" | "uploaded" | "accepted" | "needs_replacing";
};

/**
 * Work out each slot's state from its files.
 * A slot "needs replacing" when staff rejected a file and nothing newer has been uploaded.
 */
export function buildSlots(flow: AppFlow, employmentType: string | null | undefined, docs: DocView[]): SlotView[] {
  return checklistFor(flow, employmentType).map((slot) => {
    const files = docs.filter((d) => d.slot === slot.id);
    const live = files.filter((f) => f.status !== "REJECTED");
    const lastRejected = [...files].reverse().find((f) => f.status === "REJECTED");
    const newestLive = live[live.length - 1];
    let state: SlotView["state"] = "missing";
    if (lastRejected && (!newestLive || newestLive.createdAt < lastRejected.createdAt)) state = "needs_replacing";
    else if (live.length && live.every((f) => f.status === "ACCEPTED")) state = "accepted";
    else if (live.length) state = "uploaded";
    return { ...slot, files, state };
  });
}

export function missingRequired(slots: SlotView[]): SlotView[] {
  return slots.filter((s) => s.required && (s.state === "missing" || s.state === "needs_replacing"));
}
