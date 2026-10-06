"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The hero's gradient card: one real order cycling through its states (no invented stats),
 * with story-style progress tabs and a pause button.
 */
export function OrderCard({
  label,
  steps,
  pauseLabel,
  playLabel,
}: {
  label: string;
  steps: { title: string; body: string }[];
  pauseLabel: string;
  playLabel: string;
}) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setActive((a) => (a + 1) % steps.length), 4500);
    return () => window.clearTimeout(id);
  }, [active, paused, steps.length]);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={label}
      data-paused={paused}
      className="order-card on-navy bg-gradient-brand relative z-10 w-full rounded-[20px] px-5 pb-2.5 pt-4 text-white shadow-[0_20px_50px_-18px_rgba(30,43,126,.55)] sm:w-[310px]"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-bold">{label}</span>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? playLabel : pauseLabel}
          className="grid size-8 place-items-center rounded-full bg-white/15 hover:bg-white/25"
        >
          <span aria-hidden className="text-xs">
            {paused ? "▶" : "❚❚"}
          </span>
        </button>
      </div>
      <div className="relative min-h-[96px]" aria-live={paused ? "polite" : "off"}>
        {steps.map((s, i) => (
          <div
            key={s.title}
            aria-hidden={i !== active}
            className={cn(
              "absolute inset-0 transition-[opacity,transform] duration-500",
              i === active ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
            )}
          >
            <p className="text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{s.title}</p>
            <p className="mt-1.5 text-[14.5px] font-semibold text-white/90">{s.body}</p>
          </div>
        ))}
      </div>
      <div role="tablist" aria-label={label} className="flex gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.title}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-label={s.title}
            data-done={i < active}
            onClick={() => setActive(i)}
            className="order-tab flex h-6 flex-1 items-center"
          >
            <i className="relative block h-1 w-full overflow-hidden rounded bg-white/25">
              <i key={`${i}-${active}`} className="order-tab-fill absolute inset-0 block bg-white" />
            </i>
          </button>
        ))}
      </div>
    </section>
  );
}
