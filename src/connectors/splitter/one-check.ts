import { computeIvu } from "@/lib/money";
import { ConnectorNotImplementedError } from "../shared";
import type { TabSplitter } from "./types";

/** One check per table is real in pass 1; even and per-item splits come later. */
export const oneCheckSplitter: TabSplitter = {
  split(tab, rates, mode) {
    if (mode !== "one") throw new ConnectorNotImplementedError("splitter", mode);
    const subtotal = tab.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    const ivu = computeIvu(subtotal, rates);
    return [
      {
        participantId: null,
        subtotalCents: subtotal,
        ivuStateCents: ivu.state,
        ivuMunicipalCents: ivu.municipal,
      },
    ];
  },
};
