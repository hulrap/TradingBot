import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trading Bot Control Panel",
  description: "Manage your multi-chain trading bots with advanced risk management and analytics.",
  viewport: "width=device-width, initial-scale=1",
  robots: "noindex, nofollow", // Prevent indexing of trading interface
  authors: [{ name: "Trading Bot Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; 
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
} 