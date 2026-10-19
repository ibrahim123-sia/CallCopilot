import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Noto_Naskh_Arabic } from "next/font/google";
import { ToastProvider } from "@/components/ui/Toast";
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
  title: "CallCopilot",
  description:
    "Live client-call copilot with per-client memory, English + Roman Urdu captions, AI suggestions, and PDF meeting reports.",
};

// Applied before paint so dark mode never flashes light
const themeScript = `try{var t=localStorage.getItem("callcopilot_theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${urdu.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans selection:bg-stone-200 dark:selection:bg-stone-800">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
