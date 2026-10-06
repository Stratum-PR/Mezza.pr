import { ConnectorNotImplementedError } from "../shared";
import type { Notifier } from "./types";

export const resendStubNotifier: Notifier = {
  async email() {
    throw new ConnectorNotImplementedError("notifier", "resend_stub");
  },
  async sms() {
    throw new ConnectorNotImplementedError("notifier.sms", "stub");
  },
};
