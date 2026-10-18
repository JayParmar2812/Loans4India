/** Small line icons (24px grid, stroke = currentColor). Decorative by default; pass a label to make one meaningful. */
const PATHS = {
  check: "M5 12.5l4.5 4.5L19 7.5",
  shield: "M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6l7-3z M9 12l2 2 4-4",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z M14 3v5h5 M9 13h6 M9 17h4",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8z M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5",
  bank: "M3 10l9-6 9 6 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 21h18",
  lock: "M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 017 0v3",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z",
  calculator: "M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z M8 7h8v3H8z M8 14h.01 M12 14h.01 M16 14h.01 M8 17.5h.01 M12 17.5h.01 M16 17.5h.01",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18z M12 11v5 M12 8h.01",
  rupee: "M7 5h10 M7 9h10 M13 5c2.5 0 3 4 0 4H7l7 10",
  people: "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6 M16 4.5a3.5 3.5 0 010 6.5 M18.5 14.3c1.8.8 3 2.8 3 5.7",
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z M8 7h7",
  mail: "M3 6h18v12H3z M3 7l9 6 9-6",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-5", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={label ? undefined : true} role={label ? "img" : undefined} aria-label={label}>
      {PATHS[name].split(" M").map((d, i) => <path key={i} d={i === 0 ? d : `M${d}`} />)}
    </svg>
  );
}
