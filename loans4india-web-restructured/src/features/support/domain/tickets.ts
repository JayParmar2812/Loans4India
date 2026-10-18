import { z } from "zod";
import { mobileSchema } from "@/features/apply/domain/validation";

/**
 * Support, complaints and data-rights requests (Platform Flow v4, sections 36 and 41).
 * Target times are v4's proposed defaults (VERIFY the statutory ones with counsel).
 */
export const TICKET_TYPES = {
  QUERY: { label: "A question about my application or the service", dataRight: false, dueDays: 2, owner: "Support" },
  COMPLAINT: { label: "A complaint", dataRight: false, dueDays: 15, owner: "Support" },
  DATA_ACCESS: { label: "See a copy of my data", dataRight: true, dueDays: 7, owner: "Compliance" },
  DATA_CORRECTION: { label: "Correct my data", dataRight: true, dueDays: 7, owner: "Compliance" },
  DATA_ERASURE: { label: "Erase my data", dataRight: true, dueDays: 7, owner: "Compliance" },
  CONSENT_WITHDRAWAL: { label: "Withdraw my consent", dataRight: true, dueDays: 1, owner: "Compliance" },
  NOMINATE: { label: "Nominate someone to act for me", dataRight: true, dueDays: 7, owner: "Compliance" },
} as const;
export type TicketType = keyof typeof TICKET_TYPES;
export const isTicketType = (t: string): t is TicketType => t in TICKET_TYPES;

export const TICKET_STATUSES = { OPEN: "Open", IN_PROGRESS: "In progress", ESCALATED: "With the Grievance Officer", RESOLVED: "Resolved", CLOSED: "Closed" } as const;
export type TicketStatus = keyof typeof TICKET_STATUSES;

/** Outcome codes recorded when a ticket is resolved; the applicant is always told the outcome (v4 section 41). */
export const TICKET_OUTCOMES = {
  ANSWERED: "Answered",
  FIXED: "Fixed / corrected",
  DATA_PROVIDED: "Data summary provided",
  ERASED: "Erased (with legal exceptions explained)",
  CONSENT_WITHDRAWN: "Consent withdrawn, processing stopped",
  REFERRED_TO_BANK: "Referred to the bank's grievance process",
  NOT_UPHELD: "Not upheld, with reasons",
  DUPLICATE: "Duplicate request",
} as const;

export const ticketSchema = z.object({
  type: z.string().refine(isTicketType, "Pick what you need help with"),
  name: z.string().trim().min(2, "Enter your name").max(80),
  mobile: mobileSchema,
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email or leave it empty").max(120)]).optional(),
  applicationRef: z.union([z.literal(""), z.string().trim().toUpperCase().regex(/^LFI-[2-9A-HJKMNP-Z]{6}$/, "References look like LFI-7K3P9Q")]).optional(),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
  website: z.string().max(0).optional(), // honeypot
});
export type TicketInput = z.input<typeof ticketSchema>;

/** Due date: complaints are acknowledged in 1 day and resolved in 15; others per type. */
export const dueFor = (type: TicketType, from = new Date()) => new Date(from.getTime() + TICKET_TYPES[type].dueDays * 864e5);
