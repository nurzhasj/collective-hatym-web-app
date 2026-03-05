import type { Metadata } from "next";
import { Amiri } from "next/font/google";
import "./globals.css";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-arabic"
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
      <body className={`${amiri.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
