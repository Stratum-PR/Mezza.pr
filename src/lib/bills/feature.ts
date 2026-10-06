import "server-only";
import { serverEnv } from "@/lib/server-env";
export const splitWorkflowEnabled = () => serverEnv.MEZZA_SPLIT_BILL === "true";
