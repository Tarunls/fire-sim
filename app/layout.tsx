import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; 
import Providers from "./providers"; // <--- Import the new file

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Incident Commander",
  description: "Wildfire Physics Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Wrap children in the Provider */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}