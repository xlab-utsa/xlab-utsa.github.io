"use client";

import { useEffect, useRef, useState } from "react";

// Counts up from 0 to `value` once scrolled into view. Respects prefers-reduced-motion
// (shows the final value immediately, no animation instead of skipping it silently).
// This is exactly the client-side-only interactivity SPEC.md carves an exception for
// ("stat counters" — §2), not a violation of "fully static": no data fetch, just a
// requestAnimationFrame loop over a number already in the static HTML.
export function AnimatedCounter({
  value,
  duration = 1200,
}: {
  value: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from a browser API (matchMedia) only available client-side, not a performance mistake
      setDisplay(value);
      return;
    }

    let frame: number;
    let animated = false;

    const animate = () => {
      animated = true;
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated) animate();
      },
      { threshold: 0.4 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={ref}>{display}</span>;
}
