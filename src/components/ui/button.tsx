import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "sand" | "soft" | "ath" | "ok" | "danger" | "ghost";
type ButtonSize = "md" | "lg" | "sm";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 text-center font-bold transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-px active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink shadow-btn hover:brightness-110",
  // For navy and gradient bands.
  sand: "bg-sand text-navy font-extrabold hover:brightness-105",
  soft: "bg-soft text-ink hover:brightness-95",
  ath: "bg-ath text-white",
  ok: "bg-ok text-white",
  danger: "bg-bad text-white",
  ghost: "border border-line bg-surface text-ink",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-[9px] px-3 text-sm",
  md: "rounded-btn px-[22px] py-3 text-[15px]",
  lg: "rounded-btn-lg px-[26px] py-4 text-base",
};

type Common = { variant?: ButtonVariant; size?: ButtonSize; block?: boolean };

export function buttonClass({ variant = "primary", size = "md", block }: Common = {}): string {
  return cn(base, variants[variant], sizes[size], block && "w-full");
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: Common & ComponentProps<"button">) {
  return <button type={type} className={cn(buttonClass({ variant, size, block }), className)} {...props} />;
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  ...props
}: Common & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClass({ variant, size, block }), className)} {...props} />;
}
