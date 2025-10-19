import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/session-provider";
import { ReactQueryProvider } from "@/lib/react-query";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Disbursement Tracking System - Municipality",
  description: "A transparent and efficient disbursement tracking system for municipal government",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ReactQueryProvider>
          <Providers>
            {children}
          </Providers>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
