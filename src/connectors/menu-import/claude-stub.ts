import { ConnectorNotImplementedError } from "../shared";
import type { MenuImporter } from "./types";

/** AI menu import and style extraction come in a later pass. */
export const claudeStubImporter: MenuImporter = {
  async start() {
    throw new ConnectorNotImplementedError("menuImporter", "claude_stub");
  },
  async result() {
    throw new ConnectorNotImplementedError("menuImporter", "claude_stub");
  },
};
