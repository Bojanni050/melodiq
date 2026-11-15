import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

// Editorial font trio (matches the public artist page). Loaded app-wide so
// every surface shares one typographic system — see the @theme mapping in
// globals.css. Weights are limited to what the design actually uses.
// All three families are self-hosted, latin subset, straight from Google's
// static files (licences next to them in ./fonts). next/font/google downloads
// its CSS during the build, and when Google answers with something the
// Turbopack font replacer cannot read, the whole Docker build dies ("Module not
// found: @vercel/turbopack-next/internal/font/google/font") — that hit two
// deploys in a row, always on the first family in the list. Local files make
// the build hermetic: no network, no Google, no flaky deploy.
// Roboto Slab and Outfit are variable, so one file each covers every weight the
// design uses, including in-between values like 500.
const robotoSlab = localFont({
  src: "./fonts/roboto-slab-latin-variable.woff2",
  variable: "--font-roboto-slab",
  weight: "100 900",
  display: "swap",
});

const outfit = localFont({
  src: "./fonts/outfit-latin-variable.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  display: "swap",
});

// DM Mono has no variable counterpart upstream, so the two weights the design
// uses are separate files.
const dmMono = localFont({
  src: [
    { path: "./fonts/dm-mono-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-mono-latin-500.woff2", weight: "500", style: "normal" },
  ],
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
