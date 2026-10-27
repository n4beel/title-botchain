import type { Metadata, Viewport } from "next";
import { IM_Fell_English, Public_Sans, Cutive_Mono } from "next/font/google";
import { EvmProvider } from "@/components/providers/EvmProvider";
import { ToastProvider } from "@/components/ui/Toast";
import PageShell from "@/components/layout/PageShell";
import { app } from "@/lib/app-config";
import "./globals.css";

const imFellEnglish = IM_Fell_English({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const cutiveMono = Cutive_Mono({
  variable: "--font-mono",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: `${app.name} — ${app.tagline}`,
  description: app.tagline,
  openGraph: {
    title: `${app.name} — ${app.tagline}`,
    description: app.tagline,
    type: "website",
    url: app.url,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#EAE4D3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${imFellEnglish.variable} ${publicSans.variable} ${cutiveMono.variable} h-full`}
      style={{ ["--accent" as string]: app.accent }}
    >
      <body className="min-h-full antialiased bg-[#EAE4D3] text-[#26231B]">
        <EvmProvider>
          <ToastProvider>
            <PageShell>{children}</PageShell>
          </ToastProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
