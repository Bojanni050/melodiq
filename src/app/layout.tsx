import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sonara — AI Music Studio",
  description: "One prompt. One library. The best AI music models.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
