import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Cormorant_Garamond,
  EB_Garamond,
  Literata,
  Lora,
  Merriweather,
  Noto_Sans,
  Outfit,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { Toaster } from 'sonner';

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["600", "700", "900"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-story",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-editor",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-editor-fallback",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const lora = Lora({ variable: "--font-story-lora", subsets: ["latin", "vietnamese"], weight: ["400", "600"], display: "swap" });
const merriweather = Merriweather({ variable: "--font-story-merriweather", subsets: ["latin", "vietnamese"], weight: ["400", "700"], display: "swap" });
const literata = Literata({ variable: "--font-story-literata", subsets: ["latin", "vietnamese"], weight: ["400", "600"], display: "swap" });
const ebGaramond = EB_Garamond({ variable: "--font-story-eb-garamond", subsets: ["latin", "vietnamese"], weight: ["400", "600"], display: "swap" });

/* ── SEO Metadata ───────────────────────────────────────────── */
export const metadata: Metadata = {
  title: {
    default: "Đọc Truyện Tương Tác",
    template: "%s | Đọc Truyện Tương Tác",
  },
  description:
    "Web app đọc truyện với hiệu ứng hình ảnh và âm thanh sống động kích hoạt theo từng đoạn văn trong viewport.",
  keywords: ["đọc truyện", "interactive story", "hiệu ứng", "scrollytelling"],
};

import { ThemeProvider } from "@/components/ui/ThemeProvider";

/* ── Root Layout ─────────────────────────────────────────────── */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="dark"
      className={`${playfairDisplay.variable} ${cormorantGaramond.variable} ${outfit.variable} ${beVietnamPro.variable} ${notoSans.variable} ${lora.variable} ${merriweather.variable} ${literata.variable} ${ebGaramond.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)] font-ui transition-colors duration-300">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
