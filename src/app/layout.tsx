import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/util";
import Navbar from "@/components/Navbar";
import Providers from "@/components/Providers";

import "react-loading-skeleton/dist/skeleton.css";
import { Toaster } from "@/components/ui/toaster";
import "simplebar-react/dist/simplebar.min.css";
import { constructMetadata } from "@/lib/utils";


const inter = Inter({ subsets: ["latin"] });

export const metadata = constructMetadata()
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <Providers>
        <body className={cn(
          'min-h-screen font-sans antialiased grainy', inter.className
        )}>
          <Toaster />
          <Navbar />
          {children}</body>
      </Providers>
    </html>
  );
}
