/** Navigation types shared by the server shell and the client frame. */
export type AppNavKey =
  | "home"
  | "service"
  | "tables"
  | "kitchen"
  | "menu"
  | "qr"
  | "reports"
  | "export"
  | "team"
  | "settings"
  | "plan"
  | "orden";

export type AppNavItem = { href: string; key: AppNavKey; label: string; badge?: number; badgeLabel?: string };
export type AppNavGroup = { key: string; label: string; items: AppNavItem[] };
