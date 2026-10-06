"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { realtimeChannel, type MezzaEvent, type MezzaEventType } from "@/connectors/realtime";
import { registerDevice } from "@/lib/staff/actions";

const ALL: MezzaEventType[] = [
  "order.created",
  "order.updated",
  "service_request.created",
  "service_request.updated",
  "payment.updated",
  "item.availability",
];

/** This browser's device id for the restaurant, registered on first load (devices table). */
export function useDevice(slug: string, kind: "server" | "kitchen" | "register"): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const key = `mezza-device:${slug}`;
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(key);
    } catch {
      // storage unavailable
    }
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage
      setId(saved);
      return;
    }
    const name = `${kind} · ${navigator.platform || "web"}`;
    void registerDevice(slug, kind, name).then((r) => {
      if (r.ok && r.id) {
        try {
          window.localStorage.setItem(key, r.id);
        } catch {
          // ignore
        }
        setId(r.id);
      }
    });
  }, [slug, kind]);
  return id;
}

/**
 * Keeps a server-rendered staff screen fresh: polls /api/events (4 s visible, 30 s hidden) and
 * refreshes the page when something changed. Each poll also updates the device's last_seen_at.
 */
export function useLiveRefresh(
  slug: string,
  kind: "server" | "kitchen" | "register",
  impl: "polling" | "supabase_stub",
  onEvents?: (events: MezzaEvent[]) => void,
) {
  const router = useRouter();
  const device = useDevice(slug, kind);
  const callback = useRef(onEvents);
  useEffect(() => {
    callback.current = onEvents;
  }, [onEvents]);

  useEffect(() => {
    if (impl !== "polling") return;
    const endpoint = `/api/events${device ? `?device=${device}` : ""}`;
    let batch: MezzaEvent[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    return realtimeChannel("polling", endpoint).subscribe({ restaurantId: slug }, ALL, (event) => {
      batch.push(event);
      clearTimeout(timer);
      timer = setTimeout(() => {
        callback.current?.(batch);
        batch = [];
        router.refresh();
      }, 150);
    });
  }, [impl, slug, device, router]);
}

/** Minutes since an ISO time, ticking every 30 s. */
export function useMinutesSince(): (iso: string) => number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return (iso: string) => Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
}
