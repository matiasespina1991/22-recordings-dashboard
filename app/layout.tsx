import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.DASHBOARD_ORIGIN || "https://dashboard.22recordings.com",
  ),
  applicationName: "22 Recordings Dashboard",
  description:
    "Panel privado de 22 Recordings para gestionar About, Contact, eventos, artistas y medios.",
  referrer: "same-origin",
  title: {
    default: "22 Recordings — Dashboard",
    template: "%s · 22 Recordings Dashboard",
  },
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background font-sans antialiased">
        <ThemeProvider>
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
