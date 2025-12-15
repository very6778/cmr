'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { FileSpreadsheet, LogOut, Lock, Menu, X } from 'lucide-react'

export function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener('resize', checkIsMobile)

    return () => window.removeEventListener('resize', checkIsMobile)
  }, [])

  const toggleSidebar = () => setIsOpen(!isOpen)

  const sidebarContent = (
    <>
      <div className="p-4">
        <h1 className="text-2xl font-bold">UCS Group</h1>
      </div>
      <nav className="mt-8">
        <Link href="/dashboard" className={`flex items-center px-4 py-2 text-gray-700 ${pathname === '/dashboard' ? 'bg-gray-200' : ''}`}>
          <FileSpreadsheet className="mr-2" />
          PDF Oluştur
        </Link>
        <Link href="/dashboard/security" className={`flex items-center px-4 py-2 text-gray-700 ${pathname === '/dashboard/security' ? 'bg-gray-200' : ''}`}>
          <Lock className="mr-2" />
          Güvenlik
        </Link>
      </nav>
      <div className="mt-auto">
        <button
          className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-200 w-full border-t"
          onClick={() => signOut({ callbackUrl: '/' })}
        >
          <LogOut className="mr-2" />
          Çıkış Yap
        </button>
      </div>
    </>
  )

  return (
    <>
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="md:hidden fixed top-4 right-4 z-20 bg-white p-2 rounded-md shadow-md"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}
      <div
        className={`
          ${isMobile ? (isOpen ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}
          transition-transform duration-300 ease-in-out
          fixed md:static top-0 left-0 z-10
          w-64 bg-white shadow-md flex flex-col h-full
        `}
      >
        {sidebarContent}
      </div>
    </>
  )
}