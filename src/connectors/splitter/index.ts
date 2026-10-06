import { standardSplitter } from "./standard";
import type { TabSplitter } from "./types";

export * from "./types";

export function tabSplitter(): TabSplitter {
  return standardSplitter;
}
