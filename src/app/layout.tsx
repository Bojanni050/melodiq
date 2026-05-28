import type { Metadata } from "next";
import "./globals.css";
import Player from "@/components/Player";

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
    <html lang="en">
      <head>
        <link rel="icon" href="https://www.melodiq.nl/favicon.png" />
        <meta name="theme-color" content="#0d0d12" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        {children}
        <Player />
      </body>
    </html>
  );
}
