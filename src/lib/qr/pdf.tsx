import "server-only";
import {
  Circle,
  Document,
  Image,
  Page,
  Path,
  Rect,
  renderToBuffer,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import { qrDesignOf, type CardDesign, type CardTable, type PdfFormat } from "./card";
import { renderQr, type QrRender } from "./render";

const IN = 72; // points per inch

// Built-in PDF fonts (Latin-1 covers Spanish). "menu" approximates the restaurant's serif.
const FONTS = {
  menu: { regular: "Times-Roman", bold: "Times-Bold" },
  modern: { regular: "Helvetica", bold: "Helvetica-Bold" },
} as const;

/** The shared QR shapes as react-pdf SVG primitives; uploaded logos are overlaid as an Image. */
function QrCode({ render, size, logoSrc }: { render: QrRender; size: number; logoSrc?: string }) {
  const image = render.shapes.find((s) => s.kind === "image");
  return (
    <View style={{ width: size, height: size, position: "relative" }}>
      <Svg width={size} height={size} viewBox={`0 0 ${render.size} ${render.size}`}>
        {render.shapes.map((s, i) => {
          switch (s.kind) {
            case "rect":
              return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} fill={s.fill} />;
            case "circle":
              return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill} />;
            case "ring":
              return <Path key={i} d={s.d} fill={s.fill} fillRule="evenodd" />;
            case "text":
              return (
                <Text
                  key={i}
                  x={s.x}
                  y={s.y + s.size * 0.35}
                  style={{ fontSize: s.size, fontFamily: "Times-Bold" }}
                  fill={s.fill}
                  textAnchor="middle"
                >
                  {s.text}
                </Text>
              );
            default:
              return null;
          }
        })}
      </Svg>
      {image && logoSrc && (
        // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image (PDF output, no alt attribute)
        <Image
          src={logoSrc}
          style={{
            position: "absolute",
            left: (image.x / render.size) * size,
            top: (image.y / render.size) * size,
            width: (image.w / render.size) * size,
            height: (image.h / render.size) * size,
            objectFit: "contain",
          }}
        />
      )}
    </View>
  );
}

/** One card: frame, bilingual message, the code, table label, restaurant and display host. */
function Card({ design, table, width }: { design: CardDesign; table: CardTable; width: number }) {
  const font = FONTS[design.font];
  const qrSize = width * 0.72;
  const render = renderQr(table.url, qrDesignOf(design));
  return (
    <View
      style={{
        width,
        padding: width * 0.06,
        backgroundColor: design.frame,
        borderRadius: width * 0.06,
        alignItems: "center",
        border: design.frame.toUpperCase() === "#FFFFFF" ? `1pt solid #DADDEA` : undefined,
      }}
    >
      <Text
        style={{ fontFamily: font.bold, fontSize: width * 0.06, color: design.frameInk, textAlign: "center" }}
      >
        {design.frameTextEs}
      </Text>
      <Text
        style={{
          fontFamily: font.regular,
          fontSize: width * 0.045,
          color: design.frameInk,
          textAlign: "center",
          marginBottom: width * 0.04,
        }}
      >
        {design.frameTextEn}
      </Text>
      <View style={{ backgroundColor: design.bg, padding: width * 0.03, borderRadius: width * 0.04 }}>
        <QrCode render={render} size={qrSize} logoSrc={design.logoSrc} />
      </View>
      <Text
        style={{
          fontFamily: font.bold,
          fontSize: width * 0.095,
          color: design.frameInk,
          marginTop: width * 0.03,
        }}
      >
        Mesa {table.label}
      </Text>
      <Text style={{ fontFamily: font.regular, fontSize: width * 0.042, color: design.frameInk }}>
        {design.restaurantName} · {design.displayHost}
      </Text>
    </View>
  );
}

/** Letter sheet: six cards per page with dashed cut guides. */
function SheetDocument({ design, tables }: { design: CardDesign; tables: CardTable[] }) {
  const pages: CardTable[][] = [];
  for (let i = 0; i < tables.length; i += 6) pages.push(tables.slice(i, i + 6));
  const cardWidth = 3.4 * IN;
  return (
    <Document title={`${design.restaurantName} · QR`}>
      {pages.map((group, p) => (
        <Page
          key={p}
          size="LETTER"
          style={{
            padding: 0.45 * IN,
            flexDirection: "row",
            flexWrap: "wrap",
            justifyContent: "space-around",
          }}
        >
          {group.map((table) => (
            <View
              key={table.id}
              wrap={false}
              style={{
                width: 3.7 * IN,
                height: 3.3 * IN,
                alignItems: "center",
                justifyContent: "center",
                border: "0.5pt dashed #B0B5C8",
              }}
            >
              <Card design={design} table={table} width={cardWidth * 0.72} />
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
}

/** 4×6 in folded table tents: the top panel is printed upside down so it reads right once folded. */
function TentDocument({ design, tables }: { design: CardDesign; tables: CardTable[] }) {
  const half = 3 * IN;
  return (
    <Document title={`${design.restaurantName} · QR tents`}>
      {tables.map((table) => (
        <Page key={table.id} size={[4 * IN, 2 * half]} wrap={false}>
          <View
            style={{
              height: half,
              alignItems: "center",
              justifyContent: "center",
              transform: "rotate(180deg)",
            }}
          >
            <Card design={design} table={table} width={2 * IN} />
          </View>
          <View
            style={{
              height: half,
              alignItems: "center",
              justifyContent: "center",
              borderTop: "0.5pt dashed #B0B5C8",
            }}
          >
            <Card design={design} table={table} width={2 * IN} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

/** 3×3 in stickers, one per page (print on sticker stock). */
function StickerDocument({ design, tables }: { design: CardDesign; tables: CardTable[] }) {
  return (
    <Document title={`${design.restaurantName} · QR stickers`}>
      {tables.map((table) => (
        <Page
          key={table.id}
          size={[3 * IN, 3 * IN]}
          style={{ alignItems: "center", justifyContent: "center" }}
        >
          <Card design={design} table={table} width={2.15 * IN} />
        </Page>
      ))}
    </Document>
  );
}

export async function renderQrPdf(
  format: PdfFormat,
  design: CardDesign,
  tables: CardTable[],
): Promise<Buffer> {
  const doc =
    format === "sheet" ? (
      <SheetDocument design={design} tables={tables} />
    ) : format === "tent" ? (
      <TentDocument design={design} tables={tables} />
    ) : (
      <StickerDocument design={design} tables={tables} />
    );
  return renderToBuffer(doc);
}
