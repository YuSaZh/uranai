import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { UranaiProvider } from "@/context/UranaiProvider";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Uranai · 星穹塔罗占卜殿",
    template: "%s · Uranai",
  },
  description:
    "移动端优先的沉浸式塔罗占卜 Web App — 78 张典藏卡面鉴赏、每日神谕一牌、多维度牌阵抽牌与 AI 深度推理解读。",
  applicationName: "Uranai",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Uranai",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090b14",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN" data-theme="celestial-velvet" data-light="false" suppressHydrationWarning>
      <body className="antialiased selection:bg-[var(--uranai-accent-soft)]">
        <UranaiProvider>
          <AppShell>{children}</AppShell>
        </UranaiProvider>
      </body>
    </html>
  );
}
