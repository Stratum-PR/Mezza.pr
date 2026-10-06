import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** White card with a 1 px line border, 18 px radius. */
export function Panel({
  title,
  actions,
  className,
  children,
  ...props
}: { title?: ReactNode; actions?: ReactNode } & ComponentProps<"section">) {
  return (
    <section className={cn("rounded-card border border-line bg-surface p-5", className)} {...props}>
      {(title || actions) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h3 className="text-lg font-extrabold">{title}</h3>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Sand tag, as in the prototype header. */
export function Tag({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full bg-sand px-3.5 py-1.5 text-sm font-extrabold text-navy",
        className,
      )}
      {...props}
    />
  );
}

export type PillTone = "sand" | "navy" | "ok" | "warn" | "bad" | "idle";

const pillTones: Record<PillTone, string> = {
  sand: "bg-sandsoft text-olive",
  navy: "bg-soft text-accent",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad/10 text-bad",
  idle: "bg-line-2 text-muted",
};

/** Small status pill: "Agotado", "En cocina", "QR"… */
export function Pill({ tone = "navy", className, ...props }: { tone?: PillTone } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold",
        pillTones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Calm "Disponible pronto" state shown when a connector is a stub. */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface p-5">
      <Pill tone="sand">{title}</Pill>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
