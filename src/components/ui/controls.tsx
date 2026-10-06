"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Option<T extends string> = { value: T; label: ReactNode };

/**
 * Segmented control in the FSQMS language-toggle style: recessed track, raised thumb.
 * `tone="navy"` is the translucent version for the navy phone header.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = "default",
  fill = false,
  className,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: "default" | "navy";
  /** Share the full width evenly (narrow sidebars). */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        fill ? "flex w-full gap-0.5 rounded-[10px] p-[3px]" : "inline-flex gap-0.5 rounded-[10px] p-[3px]",
        tone === "navy" ? "bg-white/15" : "bg-line",
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-9 rounded-lg text-sm font-bold",
              fill ? "min-w-0 flex-1 truncate px-1.5 text-[13px]" : "min-w-10 px-3",
              tone === "navy"
                ? on
                  ? "bg-sand text-navy"
                  : "text-white"
                : on
                  ? "bg-surface text-ink shadow-[0_1px_3px_rgba(22,32,79,.15)]"
                  : "text-muted",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Horizontal filter chips (menu sections, original-menu tools). */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-9 whitespace-nowrap rounded-full border px-3 text-sm font-semibold",
            o.value === value ? "border-blue bg-soft text-blue" : "border-line text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Toggle with a visible switch track (sound, auto-print, sold out). */
export function Switch({
  checked,
  onChange,
  children,
  danger,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-line bg-surface px-3 text-sm font-semibold",
        className,
      )}
    >
      <i
        aria-hidden
        className={cn(
          "relative inline-block h-5 w-[34px] flex-none rounded-full transition-colors",
          checked ? (danger ? "bg-bad" : "bg-ok") : "bg-line",
          "after:absolute after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-[left]",
          checked ? "after:left-4" : "after:left-0.5",
        )}
      />
      {children}
    </button>
  );
}

/** Labelled input with hint and error; the error is announced and linked via aria-describedby. */
export function Field({
  label,
  hint,
  error,
  className,
  ...props
}: { label: string; hint?: string; error?: string } & ComponentProps<"input">) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-bold text-ink-2">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          "min-h-11 rounded-btn border-[1.5px] bg-bg px-3.5 text-base text-ink focus:border-sky focus:bg-surface focus:outline-none",
          error ? "border-bad" : "border-line",
        )}
        {...props}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
