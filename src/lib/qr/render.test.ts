import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { describe, expect, it } from "vitest";
import {
  qrSafety,
  qrSvgString,
  renderQr,
  type DotStyle,
  type EyeStyle,
  type LogoMode,
  type QrDesign,
} from "./render";
import { deriveQrToken, tableUrl } from "./token";

// The studio's three presets (prototype QR_PRESETS).
const PRESETS: Record<string, Pick<QrDesign, "fg" | "bg">> = {
  house: { fg: "#1F4D3A", bg: "#F3E9D2" },
  bold: { fg: "#8C2F2B", bg: "#FFFFFF" },
  clean: { fg: "#111111", bg: "#FFFFFF" },
};
const DOTS: DotStyle[] = ["square", "rounded", "dots"];
const EYES: EyeStyle[] = ["square", "rounded", "circle"];
const LOGOS: LogoMode[] = ["none", "mono", "upload"];
const LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" rx="2" fill="#B08D57"/></svg>',
)}`;

const url = tableUrl(
  "https://mezza.pr",
  "cafe-lucia",
  deriveQrToken("decode-test-secret-decode-test-secret-0001", "c0ffee00-0005-4000-8000-000000000004", 1),
);

function decode(svg: string): string | null {
  const image = new Resvg(svg, { fitTo: { mode: "width", value: 480 } }).render();
  const result = jsQR(new Uint8ClampedArray(image.pixels), image.width, image.height);
  return result?.data ?? null;
}

describe("QR renderer", () => {
  const cases = Object.entries(PRESETS).flatMap(([preset, colors]) =>
    DOTS.flatMap((dotStyle) =>
      EYES.flatMap((eyeStyle) => LOGOS.map((logoMode) => ({ preset, colors, dotStyle, eyeStyle, logoMode }))),
    ),
  );

  it.each(cases)(
    "$preset · $dotStyle dots · $eyeStyle eyes · $logoMode logo decodes to the table URL",
    ({ colors, dotStyle, eyeStyle, logoMode }) => {
      const render = renderQr(url, {
        ...colors,
        dotStyle,
        eyeStyle,
        logoMode,
        monogram: "CL",
        logoHref: LOGO_SVG,
      });
      expect(decode(qrSvgString(render))).toBe(url);
    },
  );

  it("uses error correction H whenever there is a logo or round dots", () => {
    expect(
      renderQr(url, { ...PRESETS.clean!, dotStyle: "dots", eyeStyle: "square", logoMode: "none" })
        .errorCorrection,
    ).toBe("H");
    expect(
      renderQr(url, { ...PRESETS.clean!, dotStyle: "square", eyeStyle: "square", logoMode: "none" })
        .errorCorrection,
    ).toBe("M");
    expect(
      renderQr(url, { ...PRESETS.clean!, dotStyle: "square", eyeStyle: "square", logoMode: "mono" })
        .errorCorrection,
    ).toBe("H");
  });

  it("flags low contrast and inverted codes", () => {
    expect(qrSafety("#111111", "#FFFFFF")).toMatchObject({ lowContrast: false, inverted: false });
    expect(qrSafety("#FFFFFF", "#111111").inverted).toBe(true);
    expect(qrSafety("#B0B0B0", "#FFFFFF").lowContrast).toBe(true);
  });
});
