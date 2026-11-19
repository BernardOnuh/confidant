import { Inter, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import { Sprite } from "@/components/ui";
import { config } from "@/src/config.mjs";
import { siteUrl } from "@/lib/data";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const description = "A live benchmark: AI models answer from memory for free, or buy verified intelligence on Telegraph. Graded against independent truth.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Confidant: which AI knows when it doesn't know?", template: "%s · Confidant" },
  description,
  icons: { icon: "/brand/app-icon.svg", apple: "/brand/avatar-800.png" },
  openGraph: { title: "Confidant", description, images: [{ url: "/brand/banner-x.png", width: 1500, height: 500 }], type: "website" },
  twitter: { card: "summary_large_image", title: "Confidant: which AI knows when it doesn't know?", description, images: ["/brand/banner-x.png"] },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0c0c0e" };

// Sets the theme before the page paints, so there is no flash of the wrong colours.
const themeScript = `try{var t=localStorage.getItem("theme");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}`;

const REPO = "https://github.com/BernardOnuh/confidant";

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <Sprite />
        <Nav repo={REPO} />
        {config.mock && <div className="banner"><div className="wrap"><span><b>Demo mode.</b> Three simulated models and a simulated Telegraph miner. No real model calls or payments are made.</span></div></div>}
        {children}
        <footer>
          <div className="wrap">
            <span>Confidant · Telegraph Hackathon Season II · Purchases run on testnet</span>
            <span className="foot-links"><a href="/developers">Judgment API</a><a href="/method">Method</a><a href={REPO} target="_blank" rel="noopener">Source code</a></span>
          </div>
        </footer>
      </body>
    </html>
  );
}
