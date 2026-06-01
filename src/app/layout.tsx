import type { Metadata } from "next";
import "./globals.css";
import { AdSlot } from "@/components/AdSlot";
import { Analytics } from "@/components/Analytics";
import { SiteHeader } from "@/components/SiteHeader";

const description = "Public booking information from the Big Sandy region. County, agency, charges, and booking details are available from public source records. All individuals are presumed innocent unless proven guilty in court.";

export const metadata: Metadata = {
  title: {
    default: "Big Sandy Crime Watch - Regional Booking Updates",
    template: "%s | Big Sandy Crime Watch",
  },
  description,
  metadataBase: new URL("https://BigSandyCrimeWatch.com"),
  alternates: { canonical: "/" },
  verification: { google: process.env.SEARCH_CONSOLE_VERIFICATION || undefined },
  openGraph: {
    title: "Big Sandy Crime Watch - Regional Booking Updates",
    description,
    url: "https://BigSandyCrimeWatch.com",
    siteName: "Big Sandy Crime Watch",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body><SiteHeader />{children}<footer><AdSlot placement="footer" /><strong>Big Sandy Crime Watch</strong><p>Regional public-safety news and attributed public booking records.</p></footer><Analytics /></body>
    </html>
  );
}
