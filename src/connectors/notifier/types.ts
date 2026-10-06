import type { Locale } from "../shared";

export interface Notifier {
  email(
    to: string,
    template: "staff_invite" | "demo_request" | "receipt",
    locale: Locale,
    data: Record<string, unknown>,
  ): Promise<void>;
  sms?(
    toE164: string,
    template: "receipt" | "loyalty",
    locale: Locale,
    data: Record<string, unknown>,
  ): Promise<void>;
}
