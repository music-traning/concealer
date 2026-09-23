import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://concealer-six.vercel.app"),
  title: "CONCEALER - 嘘と秘密の社内政治ローグライク",
  description: "絶体絶命のブラック企業を生き抜くAI対話型サバイバル。同僚の秘密（弱み）を収集し、会話で突きつけて絶対的な権力者たちを屈服させろ。レトロな8ビットテイストと哲学的なテキストが彩る、冷酷な企業メタプログレッション。",
  authors: [{ name: "United Make Associates", url: "https://note.com/jazzy_begin" }],
  openGraph: {
    title: "CONCEALER - 嘘と秘密の社内政治ローグライク",
    description: "絶体絶命のブラック企業を生き抜くAI対話型サバイバル。同僚の秘密（弱み）を収集し、会話で突きつけて絶対的な権力者たちを屈服させろ。",
    url: "https://concealer-six.vercel.app",
    siteName: "CONCEALER",
    images: [
      {
        url: "/ogp.jpg",
        width: 1200,
        height: 630,
        alt: "CONCEALER プロモーション画像",
      },
    ],
    locale: "ja_JP",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CONCEALER - 嘘と秘密の社内政治ローグライク",
    description: "同僚の秘密（弱み）を収集し、AIとの会話で突きつけて権力者たちを屈服させろ。レトロな8ビットテイストの企業サバイバル。",
    images: ["/ogp.jpg"],
  },
  icons: {
    icon: "/favicon.jpg",
  },
};

import { Analytics } from "@vercel/analytics/react"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
