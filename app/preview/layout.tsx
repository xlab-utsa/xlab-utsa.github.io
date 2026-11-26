import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

import { PreviewSwitcher } from "@/components/preview/switcher";
import "./preview.css";

// Home-page design previews. Temporary: once a design is chosen it becomes app/page.tsx and
// this whole route goes. Hidden from search engines and from the site's menu.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Home page previews",
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${serif.variable} pb-20`}>
      {children}
      <PreviewSwitcher />
    </div>
  );
}
