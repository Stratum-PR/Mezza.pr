import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link and router for the marketing site.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
