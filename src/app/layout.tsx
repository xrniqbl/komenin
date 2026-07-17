import type { Metadata } from "next";
import "@/styles/globals.css";
import { AppProviders } from "@/components/providers/app-providers";

import { Inter_Tight } from "next/font/google";

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aether",
  description: "Enterprise social operations control plane",
  icons: {
    icon: "/favicon.svg",
    apple: "/brand/aether-mono.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={interTight.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
