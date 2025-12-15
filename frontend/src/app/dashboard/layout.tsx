import type { Metadata } from 'next'
import { Sidebar } from '../components/sidebar'

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
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
