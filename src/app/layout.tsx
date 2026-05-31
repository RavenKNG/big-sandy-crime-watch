import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Big Sandy Crime Watch",
  description: "Big Sandy area public-safety news and public-record transparency demo.",
  metadataBase: new URL("https://BigSandyCrimeWatch.com"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><SiteHeader />{children}<footer><strong>Big Sandy Crime Watch</strong><p>Public-safety news and public-record transparency demo.</p></footer></body>
    </html>
  );
}
