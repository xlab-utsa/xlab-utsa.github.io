import type { ReactNode } from "react";

const variants = {
  core: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  secondary: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  neutral: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: keyof typeof variants;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${variants[variant]}`}
    >
      {children}
    </span>
  );
}
