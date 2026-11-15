import type { Metadata } from "next";
import { Outfit, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

// Editorial font trio (matches the public artist page). Loaded app-wide so
// every surface shares one typographic system — see the @theme mapping in
// globals.css. Weights are limited to what the design actually uses.
// Roboto Slab is self-hosted. next/font/google downloads its CSS during the
// build, and when Google answers with something the Turbopack font replacer
// cannot read, the whole Docker build dies ("Module not found:
// @vercel/turbopack-next/internal/font/google/font") — that hit two deploys in
// a row. The variable wght file covers every weight the design uses, so one
// 34 kB latin file replaces the four Google used to serve.
const robotoSlab = localFont({
  src: "./fonts/roboto-slab-latin-variable.woff2",
  variable: "--font-roboto-slab",
  weight: "100 900",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-outfit",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MelodIQ — AI Music Studio",
  description: "One prompt. One library. The best AI music models.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${robotoSlab.variable} ${outfit.variable} ${dmMono.variable}`}>
      <head>
        <meta name="theme-color" content="#0d0d12" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
