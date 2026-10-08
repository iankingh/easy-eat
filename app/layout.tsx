import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "點餐系統",
  description: "同事點餐、店家菜單與訂單管理。",
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
