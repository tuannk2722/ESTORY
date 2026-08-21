import type { Metadata } from "next";
import { Playfair_Display, Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

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
      className={`${playfairDisplay.variable} ${cormorantGaramond.variable} ${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)] font-ui transition-colors duration-300">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
