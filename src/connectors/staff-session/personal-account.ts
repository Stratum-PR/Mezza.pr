import "server-only";
import { requireStaff } from "@/lib/auth/staff";
import type { StaffSession } from "./types";

/** personal_account: everyone signs in with their own account. */
export function personalAccountSession(restaurantSlug: string): StaffSession {
  return {
    async current() {
      const ctx = await requireStaff(restaurantSlug);
      return { userId: ctx.userId, restaurantId: ctx.restaurant.id, role: ctx.role };
    },
  };
}
