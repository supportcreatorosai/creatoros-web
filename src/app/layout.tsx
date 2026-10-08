import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CreatorOS AI - AI-Powered Content Creation Platform",
    template: "%s | CreatorOS AI",
  },
  description: "CreatorOS AI is an all-in-one platform for digital creators. Generate lessons, voiceovers, avatars, thumbnails, and automate YouTube videos with AI.",
  keywords: ["AI", "Content Creation", "Creator", "Lesson Generator", "Voice Studio", "Thumbnail Generator", "YouTube Automation"],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://creatoros.ai",
    siteName: "CreatorOS AI",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "CreatorOS AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CreatorOS AI - AI-Powered Content Creation Platform",
    description: "The ultimate AI platform for content creators.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
