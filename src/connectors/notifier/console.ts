import { ConnectorNotImplementedError } from "../shared";
import type { Notifier } from "./types";

/** Logs messages instead of sending them. Locally, Supabase's mail catcher receives auth emails. */
export const consoleNotifier: Notifier = {
  async email(to, template, locale, data) {
    console.info(`[notifier] email ${template} (${locale}) to ${to}`, data);
  },
  async sms() {
    throw new ConnectorNotImplementedError("notifier.sms", "stub");
  },
};
