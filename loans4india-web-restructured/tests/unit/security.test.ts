import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, totpAt, verifyTotp } from "@/shared/security/totp";
import { safeNext } from "@/features/staff/domain/safeNext";
import { rateLimited, resetRateLimits } from "@/shared/security/request.server";
import { hashPassword, needsRehash, passwordProblem, verifyPassword } from "@/shared/security/password.server";
import { scryptSync, randomBytes } from "node:crypto";

describe("TOTP (RFC 6238)", () => {
  // RFC 6238 appendix B: ASCII secret "12345678901234567890", SHA-1, T=59 → 94287082 (8 digits) → 287082 (6 digits).
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC test vector", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(totpAt(secret, 59)).toBe("287082");
    expect(totpAt(secret, 1111111109)).toBe("081804");
  });
  it("base32 round-trips", () => {
    const b = randomBytes(20);
    expect(base32Decode(base32Encode(b)).equals(b)).toBe(true);
  });
  it("accepts the current and adjacent steps only", () => {
    const now = 1_700_000_000_000;
    const code = totpAt(secret, now / 1000);
    expect(verifyTotp(secret, code, now)).toBe(Math.floor(now / 1000 / 30));
    expect(verifyTotp(secret, totpAt(secret, now / 1000 - 30), now)).not.toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now / 1000 - 120), now)).toBeNull();
    expect(verifyTotp(secret, "12345", now)).toBeNull();
  });
});

describe("safeNext (open-redirect guard)", () => {
  it.each([
    ["/admin/applications/abc", "/admin/applications/abc"],
    ["/admin?queue=gate", "/admin?queue=gate"],
    ["https://evil.example/admin", "/admin"],
    ["//evil.example", "/admin"],
    ["/admin//evil.example", "/admin"],
    ["/admin/%2F%2Fevil", "/admin"],
    ["/\\evil", "/admin"],
    ["/apply", "/admin"],
    ["/admin/login", "/admin"],
    ["", "/admin"],
  ])("%s → %s", (input, out) => expect(safeNext(input)).toBe(out));
});

describe("rate limiter", () => {
  it("allows the limit and blocks the next hit in the window", () => {
    resetRateLimits();
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimited("k", 3, 60_000, t + i)).toBe(false);
    expect(rateLimited("k", 3, 60_000, t + 10)).toBe(true);
    expect(rateLimited("k", 3, 60_000, t + 120_000)).toBe(false);
  });
});

describe("staff passwords", () => {
  it("hashes with Argon2id and verifies", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h.startsWith("argon2id$m=19456,t=2,p=1$")).toBe(true);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong horse battery", h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });
  it("still verifies legacy scrypt hashes and flags them for rehash", async () => {
    const salt = randomBytes(16);
    const legacy = `${salt.toString("hex")}:${scryptSync("old-password-123", salt, 64).toString("hex")}`;
    expect(await verifyPassword("old-password-123", legacy)).toBe(true);
    expect(needsRehash(legacy)).toBe(true);
  });
  it("rejects short and obvious passwords", () => {
    expect(passwordProblem("short", "ravi")).toMatch(/12/);
    expect(passwordProblem("ravi-is-the-best-1", "ravi")).toMatch(/username/);
    expect(passwordProblem("my-Password-2026!", "asha")).toMatch(/guess/);
    expect(passwordProblem("tulip-kettle-orbit-91", "asha")).toBeNull();
  });
});

import { jsonLdString } from "@/shared/seo/JsonLd";

describe("JSON-LD escaping (CMS text inside a script tag)", () => {
  it("can't be closed early by content", () => {
    const out = jsonLdString({ a: "</script><script>alert(1)</script> & <b>" });
    expect(out).not.toMatch(/<|>/);
    expect(JSON.parse(out).a).toBe("</script><script>alert(1)</script> & <b>");
  });
});
