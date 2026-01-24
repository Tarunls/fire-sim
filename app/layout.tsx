"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    // 👇 suppressHydrationWarning stops the "Extra attributes" error
    // 👇 h-full ensures the map has vertical space to grow
    <html lang="en" suppressHydrationWarning className="h-full">
      <head>
        <title>Eco-Sim Commander</title>
      </head>
      <body className={`${inter.className} h-full m-0 bg-slate-900 overflow-hidden`}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}