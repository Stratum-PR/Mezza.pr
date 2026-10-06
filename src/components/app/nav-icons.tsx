import type { ReactNode } from "react";
import type { AppNavKey } from "./app-nav";

/** One line-icon family for the staff navigation: 24 px grid, 1.75 stroke, round joins. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="size-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const NAV_ICONS: Record<AppNavKey | "orden" | "more" | "close" | "signOut", ReactNode> = {
  home: (
    <Icon>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />
    </Icon>
  ),
  service: (
    <Icon>
      <path d="M4 17h16M6 17a6 6 0 0 1 12 0M12 7V5M10 5h4M3 20h18" />
    </Icon>
  ),
  tables: (
    <Icon>
      <rect x="6" y="8" width="12" height="8" rx="2" />
      <path d="M8 5v3M16 5v3M8 16v3M16 16v3" />
    </Icon>
  ),
  kitchen: (
    <Icon>
      <path d="M7 11a4 4 0 1 1 2.5-7.1A4 4 0 0 1 17 11v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1zM7 16h10" />
    </Icon>
  ),
  menu: (
    <Icon>
      <path d="M6 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6zM6 3v18M10 8h5M10 12h5M10 16h3" />
    </Icon>
  ),
  qr: (
    <Icon>
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2" />
    </Icon>
  ),
  reports: (
    <Icon>
      <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
    </Icon>
  ),
  export: (
    <Icon>
      <path d="M12 4v11M8 11l4 4 4-4M5 19h14" />
    </Icon>
  ),
  team: (
    <Icon>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.5a3 3 0 0 1 0 5.8M18 14.5a5 5 0 0 1 2.5 4.5" />
    </Icon>
  ),
  settings: (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
    </Icon>
  ),
  plan: (
    <Icon>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </Icon>
  ),
  orden: (
    <Icon>
      <path d="M8 4h8l1 3H7zM6 7h12v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2zM12 11v6M9 14h6" />
    </Icon>
  ),
  more: (
    <Icon>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  ),
  close: (
    <Icon>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  ),
  signOut: (
    <Icon>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
    </Icon>
  ),
};
