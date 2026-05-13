import type { Metadata, Viewport } from "next";
import { LanguageProvider } from "@/components/premium/language-provider";
import { ThemeProvider } from "@/components/premium/theme-provider";
import { ToastProvider } from "@/components/premium/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Workspace Premium",
    template: "%s | Workspace Premium",
  },
  description: "A multi-device workspace booking system for reservations, QR check-in, admin setup and booking operations.",
  applicationName: "Workspace Premium",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Workspace Premium",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Workspace Premium",
    description: "Book workspaces, scan QR labels and manage office floors from desktop or mobile web.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#020617",
};

export default function FinalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen flex flex-col">
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
