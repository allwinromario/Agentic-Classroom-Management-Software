import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { AlertBanner } from "@/components/AlertBanner";
import { SocketProvider } from "@/components/SocketProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SCMS — Smart Classroom Management System",
  description: "AI-powered classroom management with facial recognition, real-time attendance, and intelligent automation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full bg-[#0f0f12] text-zinc-100">
        <AuthProvider>
          <SocketProvider>
            {children}
            <AlertBanner />
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
