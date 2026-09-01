import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
// The landing's two faces. next/font downloads and self-hosts them at build
// time, so they do not depend on the running server reaching Google — which
// is also why the HTML preview fell back to system fonts in a sandbox and
// this will not. Archivo is loaded with its width axis because the landing
// pushes it between 108 and 118; a static Archivo Bold cannot do that.
import { archivo, inter } from "@/lib/fonts";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The site's own address, needed to turn /og.png into the absolute URL that
 * social apps require — a relative one is ignored and no card is drawn.
 *
 * clipit.space is the real domain, given by the owner, so it is the default
 * rather than something a deployment has to remember to set. The environment
 * variable still wins, which is what makes staging and preview deployments
 * able to point at themselves instead of claiming to be production.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://clipit.space";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "CLIPIT",
  description:
    "Drop in a long video, describe the moment you want in plain language, and get the clip.",
  /**
   * app/icon.svg, app/apple-icon.png and app/favicon.ico are picked up by
   * convention; these two are the larger PWA sizes, which are not, and which
   * Android uses for a home-screen shortcut.
   */
  icons: {
    other: [
      { rel: "icon", url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
