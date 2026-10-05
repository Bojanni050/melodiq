import type { Metadata } from "next";
import { Roboto_Slab, Outfit, DM_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/ClientLayout";

// Editorial font trio (matches the public artist page). Loaded app-wide so
// every surface shares one typographic system — see the @theme mapping in
// globals.css. Weights are limited to what the design actually uses.
const robotoSlab = Roboto_Slab({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-roboto-slab",
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
