import type { Metadata } from "next";
import { Amiri, Montserrat } from "next/font/google";
import "./globals.css";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic"
});

const montserrat = Montserrat({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-montserrat"
});

export const metadata: Metadata = {
  title: "Hatym Kiosk",
  description: "Collective Quran hatym page distribution"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${amiri.variable} ${montserrat.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
