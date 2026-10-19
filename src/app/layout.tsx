import type { Metadata } from "next";
import { Unbounded, Manrope } from "next/font/google";
import "./globals.css";

const display = Unbounded({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Nicolas Villegas-Kirchman — Applied ML × Software Engineering",
  description:
    "Applied AI/ML and software engineering work: production ML pipelines, distributed systems, and diagnostic imaging models, with measured outcomes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        {/* The world's headings are extruded from these outlines, so the fetch
            gates the first frame — start it with the document, not after
            hydration. */}
        <link
          rel="preload"
          href="/fonts/unbounded-600.typeface.json"
          as="fetch"
          type="application/json"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
