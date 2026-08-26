import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
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

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CLIPIT",
  description:
    "Drop in a long video, describe the moment you want in plain language, and get the clip.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} ${archivo.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
