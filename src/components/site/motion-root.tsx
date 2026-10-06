"use client";

import { useEffect } from "react";

/**
 * Turns on the marketing-site motion layer (html.motion-on) unless the visitor prefers reduced
 * motion, and reveals [data-m] elements as they scroll into view.
 */
export function MotionRoot() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("motion-on");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("m-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    document.querySelectorAll("[data-m]").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("motion-on");
    };
  }, []);
  return null;
}
