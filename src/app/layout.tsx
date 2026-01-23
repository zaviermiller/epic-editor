import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";

/**
 * Primary font configuration using Inter for clean, technical readability
 * as specified in the PRD typography hierarchy
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitHub Epic Visualizer",
  description:
    "Visualize GitHub Epic issues, their Batch sub-issues, and task dependencies in an interactive diagram",
};

/**
 * Root layout component with dark mode as default theme
 * Uses Inter font family for all text as per PRD specifications
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
