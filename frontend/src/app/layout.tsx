import './globals.css'
import type { Metadata } from 'next'
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: 'UCS Group CMR System',
  description: 'UCS Group CMR System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <div>
          <main>
            {children}
          </main>
          <Toaster />
        </div>
      </body>
    </html>
  )
}