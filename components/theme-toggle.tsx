"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

// `resolvedTheme` is NOT reliably undefined during the client's first render — next-
// themes can resolve it from localStorage before hydration finishes, which mismatches
// the server's render (server has no localStorage) and breaks hydration. The correct
// fix (per next-themes' own docs) is an explicit mounted flag so the client's first
// render matches the server's, then swaps to the real icon post-mount.
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- required by the pattern above, not a performance mistake
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={
        mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"
      }
      className="flex size-7 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )
      ) : (
        <span className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
