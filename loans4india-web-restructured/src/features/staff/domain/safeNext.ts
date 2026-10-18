/**
 * Where to go after sign-in. Only staff pages on this site: anything else (another host, "//evil", "/\evil",
 * a scheme, an encoded slash) falls back to the control tower. Prevents open redirects through ?next=.
 */
export function safeNext(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!/^\/admin(\/[A-Za-z0-9_\-/]*)?(\?[A-Za-z0-9_\-=&%.]*)?$/.test(v)) return "/admin";
  if (v.startsWith("/admin/login") || v.startsWith("/admin/mfa")) return "/admin";
  if (/%2f|%5c|\/\//i.test(v)) return "/admin";
  return v;
}
