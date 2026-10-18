import "server-only";

/**
 * SMS channel (Platform Flow v4, section 42). Business SMS in India needs a DLT-registered sender header and templates,
 * so no real provider is wired in until those exist. Without one:
 *  - development and tests use the console provider (prints to the server log; codes never leave the machine);
 *  - production has no provider, so anything that needs SMS (OTP) fails closed with a plain message.
 * Adding a provider = implement SmsProvider and return it from smsProvider() when its env vars are set.
 */
export type SmsResult = { ok: true; provider: string; ref: string } | { ok: false; provider: string; error: string };

export interface SmsProvider {
  readonly name: string;
  send(to: string, text: string, meta: { template: string; dltTemplateId?: string }): Promise<SmsResult>;
}

/** Messages "sent" by the console provider in this process, newest last. Tests read OTPs from here. */
export const devOutbox: { to: string; text: string; template: string; at: Date }[] = [];

const consoleProvider: SmsProvider = {
  name: "console",
  async send(to, text, meta) {
    devOutbox.push({ to, text, template: meta.template, at: new Date() });
    if (devOutbox.length > 200) devOutbox.shift();
    if (process.env.NODE_ENV !== "test") console.info(`[sms:console] to ******${to.slice(-4)} (${meta.template}): ${text}`);
    return { ok: true, provider: "console", ref: `console-${devOutbox.length}` };
  },
};

export function smsProvider(): SmsProvider | null {
  if (process.env.SMS_PROVIDER === "console" || process.env.NODE_ENV !== "production") return consoleProvider;
  // e.g. if (process.env.SMS_PROVIDER === "msg91" && process.env.MSG91_AUTH_KEY) return msg91Provider;
  return null;
}

export const maskMobileTail = (m: string) => `******${m.slice(-4)}`;
