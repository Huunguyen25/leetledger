import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LeetLedger",
    template: "%s · LeetLedger",
  },
  description:
    "A focused spaced-repetition and mastery workspace for LeetCode.",
};

const themeScript = `
  try {
    const saved = localStorage.getItem("leetledger-theme");
    document.documentElement.dataset.theme =
      saved === "light" || saved === "dark" ? saved : "dark";
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased`}
      >
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
