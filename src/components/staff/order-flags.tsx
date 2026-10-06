"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { FloorOrder } from "@/lib/staff/floor";

/** "Mesa nueva por QR" and "Pagó y pidió de nuevo" on an order, always as text (never colour alone). */
export function OrderFlags({
  order,
  className,
}: {
  order: Pick<FloorOrder, "openedTab" | "afterPayment">;
  className?: string;
}) {
  const t = useTranslations("staff.service");
  if (!order.openedTab && !order.afterPayment) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {order.openedTab && (
        <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs font-bold text-warn">
          {t("newTable")}
        </span>
      )}
      {order.afterPayment && (
        <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-accent">
          {t("afterPayment")}
        </span>
      )}
    </span>
  );
}
