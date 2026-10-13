import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Naskh_Arabic } from "next/font/google";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const urdu = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  variable: "--font-urdu",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CallCopilot - Real-time Live Client Call Assistant",
  description:
    "Stateless, in-memory live client call copilot with dual-channel transcription, real-time insight cards, NEW skill detection, and executive wrap-up PDF reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${urdu.variable} antialiased`}>
      <body className="min-h-screen bg-background text-foreground font-sans selection:bg-stone-200 dark:selection:bg-stone-800 transition-colors duration-150">
        {children}
      </body>
    </html>
  );
}
