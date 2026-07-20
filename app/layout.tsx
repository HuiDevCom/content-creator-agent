import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { UserProvider } from "./lib/user-context";

export const metadata: Metadata = {
  title: "内容创作Agent",
  description: "内容创作 AI Agent，支持联网搜索、主题研究、大纲生成、文章写作与 SEO 优化",
  icons: "/favicon.png",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 antialiased">
        <UserProvider><I18nProvider>{children}</I18nProvider></UserProvider>
      </body>
    </html>
  );
}
