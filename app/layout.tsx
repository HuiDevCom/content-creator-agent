import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";
import { UserProvider } from "./lib/user-context";

export const metadata: Metadata = {
  title: {
    default: "内容创作Agent",
    template: "%s | 内容创作Agent",
  },
  description: "内容创作 AI Agent，支持联网搜索、主题研究、大纲生成、文章写作与 SEO 优化",
  keywords: ["AI写作", "内容创作", "SEO优化", "文章生成", "大纲生成", "联网搜索"],
  icons: "/favicon.png",
  metadataBase: new URL("https://content-creator.agent.huidev.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "内容创作Agent",
    description: "内容创作 AI Agent，支持联网搜索、主题研究、大纲生成、文章写作与 SEO 优化",
    url: "https://content-creator.agent.huidev.com",
    siteName: "内容创作Agent",
    images: [{ url: "/favicon.png", width: 512, height: 512 }],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "内容创作Agent",
    description: "内容创作 AI Agent，支持联网搜索、主题研究、大纲生成、文章写作与 SEO 优化",
    images: ["/favicon.png"],
  },
  other: {
    "application-name": "内容创作Agent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "内容创作Agent",
    description: "内容创作 AI Agent，支持联网搜索、主题研究、大纲生成、文章写作与 SEO 优化",
    url: "https://content-creator.agent.huidev.com",
    applicationCategory: "ContentCreation",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="zh">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950 antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <UserProvider><I18nProvider>{children}</I18nProvider></UserProvider>
      </body>
    </html>
  );
}
