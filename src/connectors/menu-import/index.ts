import "server-only";
import { pickImplementation } from "../shared";
import { claudeStubImporter } from "./claude-stub";
import { fixtureImporter } from "./fixture";
import type { MenuImporter } from "./types";

export * from "./types";

const impl = pickImplementation("MEZZA_MENU_IMPORTER", ["fixture", "claude_stub"] as const, "fixture");

export function menuImporter(): MenuImporter {
  return impl === "fixture" ? fixtureImporter : claudeStubImporter;
}
