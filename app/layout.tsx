import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'
import { PhoneLoginProvider } from "@/components/phone-login-provider"

const _inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Agenda da Igreja',
  description: 'Sistema de agenda e programacao de cultos da igreja',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <PhoneLoginProvider>
          {children}
          <Toaster />
        </PhoneLoginProvider>
      </body>
    </html>
  )
}
