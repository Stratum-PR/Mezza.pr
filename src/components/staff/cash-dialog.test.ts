import { describe, expect, it } from "vitest";
import { quickAmounts } from "./cash-dialog";

describe("cash quick amounts", () => {
  it("offers the next round bills above the total", () => {
    expect(quickAmounts(1237)).toEqual([1500, 2000, 4000]);
    expect(quickAmounts(2000)).toEqual([4000, 5000, 10000]);
    expect(quickAmounts(8550)).toEqual([9000, 10000, 12000]);
  });
});
