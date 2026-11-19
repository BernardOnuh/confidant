import { Inter, JetBrains_Mono } from "next/font/google";
import { Sprite } from "@/components/ui";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

// The public address, for share cards. Vercel provides it; set SITE_URL to override (e.g. a custom domain).
const site = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
const description = "A live benchmark: AI models answer from memory for free, or buy verified intelligence on Telegraph. Graded against independent truth.";

export const metadata = {
  metadataBase: new URL(site),
  title: "Confidant: which AI knows when it doesn't know?",
  description,
  icons: { icon: "/brand/app-icon.svg", apple: "/brand/avatar-800.png" },
  openGraph: { title: "Confidant", description, images: [{ url: "/brand/banner-x.png", width: 1500, height: 500 }], type: "website" },
  twitter: { card: "summary_large_image", title: "Confidant: which AI knows when it doesn't know?", description, images: ["/brand/banner-x.png"] },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0c0c0e" };

// Sets the theme before the page paints, so there is no flash of the wrong colours.
const themeScript = `try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><Sprite />{children}</body>
    </html>
  );
}
