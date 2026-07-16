import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";

const inter = {
  variable: "--font-sans",
  className: "font-sans",
} as { variable: string; className: string };

const geistMono = {
  variable: "--font-mono",
  className: "font-mono",
} as { variable: string; className: string };

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
    <html lang="en" className={cn(inter.variable, geistMono.variable)}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
