import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  title: {
    template: "%s · EventHub",
    default: "EventHub",
  },
  description:
    "QR-based event management, attendance, and digital certificates for the College Local Council of Wesleyan University–Philippines.",
  applicationName: "EventHub",
  // Lets iOS open the home-screen app standalone; the touch icon comes from app/apple-icon.png.
  appleWebApp: { capable: true, title: "EventHub", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
