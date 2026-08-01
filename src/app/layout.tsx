import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { getCurrentFan } from "@/lib/server/auth/requireFan";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "matchpass.xyz",
  title: "matchpass.xyz — stablecoin matchday tickets",
  description: "Buy football tickets with stablecoins. Issued on Arc.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fan = await getCurrentFan();
  const theme = isThemePreference(fan?.themePreference)
    ? fan.themePreference
    : "system";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <SiteHeader fan={fan} />
        {children}
      </body>
    </html>
  );
}

function isThemePreference(
  value: string | null | undefined,
): value is "system" | "light" | "dark" {
  return value === "system" || value === "light" || value === "dark";
}
