import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { S } from "@/lib/strings";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: S.appName,
  description: "DalConnect admin dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html dir="rtl" lang="ar" className={cairo.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
