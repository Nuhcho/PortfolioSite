import type { Metadata } from "next";
import { Cabin } from "next/font/google";
import "./globals.css";
import { profile } from "@/data/content";

/* One humanist family for everything, the way Monument Valley's own site sets
   all of its type in Humanist 521. Cabin is drawn from the same Johnston and
   Gill lineage, so titles can go uppercase and tracked without turning
   mechanical. */
const humanist = Cabin({
  variable: "--font-humanist",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: `${profile.name} | Software Engineering Portfolio`,
  description:
    "Explore Nicolas Villegas-Kirchman’s projects and experience in applied machine learning, backend development, data pipelines, and cloud infrastructure.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={humanist.variable}>
      <body>{children}</body>
    </html>
  );
}

