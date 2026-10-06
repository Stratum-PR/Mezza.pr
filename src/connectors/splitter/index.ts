import { oneCheckSplitter } from "./one-check";
import type { TabSplitter } from "./types";

export * from "./types";

export function tabSplitter(): TabSplitter {
  return oneCheckSplitter;
}
