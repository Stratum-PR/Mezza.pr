import type { MezzaEvent, RealtimeChannel } from "./types";

const VISIBLE_MS = 4000;
const HIDDEN_MS = 30_000;

/**
 * Polls /api/events?since= every 4 s while the page is visible and backs off to 30 s when hidden.
 * The route derives events from updated_at and scopes them by the caller's role (or, for guests,
 * by the resolved table token passed as `endpoint`).
 */
export function pollingChannel(endpoint = "/api/events"): RealtimeChannel {
  return {
    subscribe(scope, types, onEvent) {
      let since = new Date().toISOString();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let stopped = false;

      const tick = async () => {
        if (stopped) return;
        try {
          const params = new URLSearchParams({
            since,
            restaurant: scope.restaurantId,
            types: types.join(","),
          });
          if (scope.tabId) params.set("tab", scope.tabId);
          const sep = endpoint.includes("?") ? "&" : "?";
          const res = await fetch(`${endpoint}${sep}${params}`, { cache: "no-store" });
          if (res.ok) {
            const events = (await res.json()) as MezzaEvent[];
            for (const e of events) {
              if (Date.parse(e.at) > Date.parse(since)) since = e.at; // compare times, not strings
              if (types.includes(e.type)) onEvent(e);
            }
          }
        } catch {
          // Offline or server busy: try again on the next tick.
        }
        schedule();
      };

      const schedule = () => {
        if (stopped) return;
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        timer = setTimeout(tick, hidden ? HIDDEN_MS : VISIBLE_MS);
      };

      const onVisible = () => {
        if (document.visibilityState === "visible") {
          clearTimeout(timer);
          void tick();
        }
      };

      if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible);
      schedule();
      return () => {
        stopped = true;
        clearTimeout(timer);
        if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible);
      };
    },
  };
}
