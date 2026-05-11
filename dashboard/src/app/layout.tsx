import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

// Outfitフォントを適用（モダンでゲーム風のデザインに合う）
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
});

export const metadata: Metadata = {
  title: "CreateXP - Level Up Your Creativity",
  description: "クリエイティブ作業をXP化して、制作の習慣化とモチベーション向上を実現するプラットフォーム。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${outfit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-outfit)]">
        <Header />
        <div className="flex-grow">
          {children}
        </div>
      </body>
    </html>
  );
}
