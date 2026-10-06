import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const DOCS = { terminos: "terms", privacidad: "privacy", datos: "data" } as const;
type DocSlug = keyof typeof DOCS;
const UPDATED = "2026-10-05";

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

function isDoc(doc: string): doc is DocSlug {
  return doc in DOCS;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isDoc(doc)) return {};
  const t = await getTranslations("site.legal");
  return { title: t(`${DOCS[doc]}.title`) };
}

/** Draft legal pages, clearly marked as needing legal review in both languages. */
export default async function LegalPage({ params }: PageProps<"/[locale]/legal/[doc]">) {
  const { locale, doc } = await params;
  if (!isDoc(doc)) notFound();
  const t = await getTranslations("site.legal");
  const key = DOCS[doc];
  const date = new Date(`${UPDATED}T12:00:00Z`).toLocaleDateString(locale === "en" ? "en-US" : "es-PR", {
    dateStyle: "long",
  });
  return (
    <article className="mx-auto max-w-[780px] px-[var(--gutter)] py-12">
      <div
        role="note"
        className="mb-6 rounded-card border border-line border-l-4 border-l-sand bg-surface px-5 py-4"
      >
        <p className="font-bold">{t("draft")}</p>
        <p className="text-sm text-muted">{t("draftBody")}</p>
      </div>
      <h1 className="mb-1 text-[clamp(30px,4vw,42px)] font-extrabold tracking-[-0.03em]">
        {t(`${key}.title`)}
      </h1>
      <p className="mb-6 text-sm text-muted">{t("updated", { date })}</p>
      {(t.raw(`${key}.body`) as string[]).map((p) => (
        <p key={p} className="mb-4 text-[16px] leading-[1.65] text-ink-2">
          {p}
        </p>
      ))}
      <Link href="/" className="mt-6 inline-block font-bold text-blue">
        ← {t("back")}
      </Link>
    </article>
  );
}
