import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatCents } from "@/lib/money";
import type { IvuLabels, IvuSummary } from "./ivu";

const NAVY = "#1E2B7E";
const INK = "#16204F";
const MUTED = "#586187";
const LINE = "#E2E5EC";
const SOFT = "#EEF0F8";

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 48,
    paddingTop: 40,
    paddingBottom: 52,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: INK,
  },
  brand: { fontFamily: "Helvetica-Bold", fontSize: 10, color: NAVY, marginBottom: 10 },
  title: { fontFamily: "Helvetica-Bold", fontSize: 16, marginBottom: 6 },
  meta: { color: MUTED, marginBottom: 2 },
  disclaimer: {
    marginTop: 10,
    marginBottom: 16,
    padding: 8,
    backgroundColor: "#F6F3CF",
    color: "#5B5410",
    borderRadius: 4,
  },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 2 },
  head: { backgroundColor: SOFT, fontFamily: "Helvetica-Bold", borderBottomWidth: 0 },
  total: { fontFamily: "Helvetica-Bold", borderTopWidth: 1, borderTopColor: INK, borderBottomWidth: 0 },
  date: { width: "16%", paddingLeft: 4 },
  num: { width: "16.8%", textAlign: "right", paddingRight: 4 },
  footer: {
    position: "absolute",
    bottom: 28,
    left: 48,
    right: 48,
    flexDirection: "row",
    color: MUTED,
    fontSize: 8,
  },
});

export function renderIvuPdf(
  summary: IvuSummary,
  l: IvuLabels & { dayLabel: (ymd: string) => string; page: string },
) {
  const m = (c: number) => formatCents(c, "es");
  const doc = (
    <Document title={`${l.title} · ${l.periodValue}`} author="Mezza">
      <Page size="LETTER" style={s.page}>
        <Text style={s.brand}>Mezza</Text>
        <Text style={s.title}>{l.title}</Text>
        <Text style={s.meta}>
          {l.restaurant}: {summary.restaurant.name}
          {summary.restaurant.address ? ` · ${summary.restaurant.address}` : ""}
        </Text>
        <Text style={s.meta}>
          {l.period}: {l.periodValue}
        </Text>
        <Text style={s.meta}>
          {l.generated}: {l.generatedValue}
        </Text>
        <Text style={s.disclaimer}>{l.disclaimer}</Text>

        <View style={[s.row, s.head]} fixed>
          <Text style={s.date}>{l.date}</Text>
          <Text style={s.num}>{l.taxable}</Text>
          <Text style={s.num}>{l.state}</Text>
          <Text style={s.num}>{l.municipal}</Text>
          <Text style={s.num}>{l.totalIvu}</Text>
          <Text style={s.num}>{l.refunds}</Text>
        </View>
        {summary.days.map((d) => (
          <View key={d.date} style={s.row} wrap={false}>
            <Text style={s.date}>{l.dayLabel(d.date)}</Text>
            <Text style={s.num}>{m(d.taxable)}</Text>
            <Text style={s.num}>{m(d.state)}</Text>
            <Text style={s.num}>{m(d.municipal)}</Text>
            <Text style={s.num}>{m(d.state + d.municipal)}</Text>
            <Text style={s.num}>{m(d.refunds)}</Text>
          </View>
        ))}
        <View style={[s.row, s.total]} wrap={false}>
          <Text style={s.date}>{l.total}</Text>
          <Text style={s.num}>{m(summary.totals.taxable)}</Text>
          <Text style={s.num}>{m(summary.totals.state)}</Text>
          <Text style={s.num}>{m(summary.totals.municipal)}</Text>
          <Text style={s.num}>{m(summary.totals.state + summary.totals.municipal)}</Text>
          <Text style={s.num}>{m(summary.totals.refunds)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={{ flex: 1 }}>{summary.restaurant.name}</Text>
          <Text render={({ pageNumber, totalPages }) => `${l.page} ${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
