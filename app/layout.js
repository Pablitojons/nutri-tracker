import { Syne, DM_Mono } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata = {
  title: "Nutri Tracker",
  description:
    "Suivi nutritionnel : tableau de bord, menu du jour avec IA et analyse de photos.",
  applicationName: "Nutri Tracker",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nutri Tracker",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon-source.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon-source.svg", type: "image/svg+xml", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#120a10" },
    { media: "(prefers-color-scheme: light)", color: "#120a10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={`${syne.variable} ${dmMono.variable} h-full`}>
      <body className="relative min-h-full">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 mesh-noise opacity-[0.18]" />
        {children}
      </body>
    </html>
  );
}
