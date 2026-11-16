import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial typography: a light condensed serif for headlines and numbers,
// a tight grotesk for everything else.
const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
});

const body = Inter_Tight({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono-num",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const viewport: Viewport = {
  themeColor: "#0B0E13",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "IPL Dynasty — Franchise & Auction Simulator",
  description:
    "Take control of an IPL franchise across multiple seasons. Manage retentions, scout 1,200+ cricketers, battle 9 intelligent CPU general managers in live mega auctions, set Playing XIs, and simulate ball-by-ball matches.",
  keywords: [
    "IPL",
    "IPL Auction",
    "IPL Simulator",
    "Cricket Management Game",
    "IPL Dynasty",
    "Cricket Auction Simulator",
    "Mega Auction",
  ],
  authors: [{ name: "IPL Dynasty Team" }],
  openGraph: {
    title: "IPL Dynasty — Multi-Season Cricket Franchise Mode",
    description:
      "Run your IPL franchise: Retentions, 1,250+ player database, real-time live auctions with 9 CPU GMs, tactical Playing XI management, and ball-by-ball match simulation.",
    type: "website",
    locale: "en_US",
    siteName: "IPL Dynasty",
  },
  twitter: {
    card: "summary_large_image",
    title: "IPL Dynasty — Multi-Season Cricket Franchise Mode",
    description:
      "Battle 9 intelligent CPU general managers in live IPL auctions, scout 1,200+ real cricketers, and simulate multi-season dynasties.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
