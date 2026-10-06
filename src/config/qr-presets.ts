/** The QR studio's three presets (prototype QR_PRESETS), as qr_designs columns. */
export const QR_PRESETS = {
  house: {
    fg: "#1F4D3A",
    bg: "#F3E9D2",
    frame: "#1F4D3A",
    frame_ink: "#F3E9D2",
    dot_style: "rounded",
    eye_style: "rounded",
    logo_mode: "mono",
    font: "menu",
  },
  bold: {
    fg: "#8C2F2B",
    bg: "#FFFFFF",
    frame: "#B08D57",
    frame_ink: "#2A2620",
    dot_style: "dots",
    eye_style: "circle",
    logo_mode: "mono",
    font: "menu",
  },
  clean: {
    fg: "#111111",
    bg: "#FFFFFF",
    frame: "#FFFFFF",
    frame_ink: "#111111",
    dot_style: "square",
    eye_style: "square",
    logo_mode: "none",
    font: "modern",
  },
} as const;

export type QrPresetId = keyof typeof QR_PRESETS;
