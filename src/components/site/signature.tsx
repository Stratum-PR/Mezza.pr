"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The home page's one bold moment: the printed menu becomes the phone menu. Plays once when it
 * scrolls into view (and again on request). Its resting state, and the reduced-motion view, is the
 * two side by side.
 */
export function Signature({
  page,
  phone,
  beforeLabel,
  afterLabel,
  replayLabel,
}: {
  page: ReactNode;
  phone: ReactNode;
  beforeLabel: string;
  afterLabel: string;
  replayLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRun((r) => (r === 0 ? 1 : r));
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <div
        key={run}
        className={cn(
          "sig grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto_350px] md:gap-8",
          run > 0 && "play",
        )}
      >
        <figure className="sig-page mx-auto w-full max-w-[420px]">
          <div className="relative overflow-hidden rounded-md shadow-hero">
            {page}
            <span
              aria-hidden
              className="sig-scan absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-sky/40 to-transparent"
            />
          </div>
          <figcaption className="mt-3 text-center text-sm font-semibold text-muted">{beforeLabel}</figcaption>
        </figure>
        <div
          aria-hidden
          className="sig-arrow mx-auto text-3xl font-extrabold text-blue md:rotate-0 rotate-90"
        >
          →
        </div>
        <figure className="sig-phone">
          {phone}
          <figcaption className="mt-3 text-center text-sm font-semibold text-muted">{afterLabel}</figcaption>
        </figure>
      </div>
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setRun((r) => r + 1)}
          className="min-h-11 rounded-btn px-4 text-sm font-bold text-blue hover:bg-soft"
        >
          {replayLabel}
        </button>
      </div>
    </div>
  );
}
