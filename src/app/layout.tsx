import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

/* ── Google Fonts ───────────────────────────────────────────── */
const cinzel = Cinzel({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  display: "swap",
});

const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-story",
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-ui",
  subsets: ["latin"],
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
      className={`${cinzel.variable} ${cormorantGaramond.variable} ${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)] font-ui">
        {children}
      </body>
    </html>
  );
}
