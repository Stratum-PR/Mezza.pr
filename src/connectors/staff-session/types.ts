import type { Ctx, Role } from "../shared";

export interface StaffSession {
  current(): Promise<{ userId: string; restaurantId: string; role: Role } | null>;
  switchWithPin?(deviceId: string, pin: string): Promise<{ userId: string; role: Role }>;
  setPin?(ctx: Ctx, userId: string, pin: string): Promise<void>;
}
