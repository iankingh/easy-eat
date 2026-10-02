import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "午餐團訂｜同事點餐",
  description: "同事午餐每日團訂與訂單管理。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
