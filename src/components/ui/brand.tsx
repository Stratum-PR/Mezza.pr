import Image from "next/image";
import { cn } from "@/lib/cn";

/** Stratum mark: three rounded, overlapping diamonds (sand, sky, navy). Never redraw with sharp corners. */
export function StratumMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 60 44"
      className={cn("h-10 w-[54px] flex-none", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="mz-sand" x1="0" x2="1">
          <stop offset="0" stopColor="#F1F7B5" />
          <stop offset="1" stopColor="#E6E09E" />
        </linearGradient>
        <linearGradient id="mz-sky" x1="0" x2="1">
          <stop offset="0" stopColor="#6FC6D6" />
          <stop offset="1" stopColor="#5FA3DA" />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="26" height="26" rx="6" transform="rotate(45 17 21)" fill="url(#mz-sand)" />
      <rect
        x="17"
        y="8"
        width="26"
        height="26"
        rx="6"
        transform="rotate(45 30 21)"
        fill="url(#mz-sky)"
        fillOpacity=".92"
      />
      <rect
        x="30"
        y="8"
        width="26"
        height="26"
        rx="6"
        transform="rotate(45 43 21)"
        fill="#1E2B7E"
        fillOpacity=".95"
      />
    </svg>
  );
}

/** Mark + "Mezza" wordmark + "por Stratum PR". */
export function MezzaWordmark({ byline, className }: { byline: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <StratumMark className="h-8 w-11" />
      <span className="leading-none">
        <span className="block text-2xl font-extrabold tracking-[-0.03em]">Mezza</span>
        <span className="mt-0.5 block text-xs font-semibold text-muted">{byline}</span>
      </span>
    </span>
  );
}

export function StratumLogo({ onDark, className }: { onDark?: boolean; className?: string }) {
  return (
    <Image
      src={onDark ? "/brand/stratum-logo-on-dark.png" : "/brand/stratum-logo-on-light.png"}
      alt="Stratum"
      width={3834}
      height={720}
      className={cn("h-8 w-auto", className)}
    />
  );
}
