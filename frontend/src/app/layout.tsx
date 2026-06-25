import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/i18n/provider";
import { ThemeInitializer } from "@/components/theme/theme-initializer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pestify",
  description: "Manage and visualize AI-detected insect counts in greenhouses",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeInitializer />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
