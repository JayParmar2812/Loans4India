const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹2,00,000 */
export const formatINR = (n: number) => inr.format(Math.round(n));
/** 2,00,000 */
export const formatNum = (n: number) => num.format(Math.round(n));

/** ₹2 lakh / ₹1.5 crore — for headlines. */
export function formatLakh(n: number): string {
  if (n >= 1e7) return `₹${trim(n / 1e7)} crore`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} lakh`;
  return formatINR(n);
}
const trim = (x: number) => (Math.round(x * 100) / 100).toString();

/** Mask a mobile number for display: 98XXXXXX21 */
export const maskMobile = (m: string) => (m.length === 10 ? `${m.slice(0, 2)}XXXXXX${m.slice(8)}` : m);
