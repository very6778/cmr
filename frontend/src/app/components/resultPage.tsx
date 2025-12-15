'use client'

import { Button } from "@/components/ui/button"
import { CheckCircle } from 'lucide-react'

interface ResultPageProps {
  fileName: string
  pdfBlob: Blob
  onReset: () => void
}

export function ResultPage({ fileName, pdfBlob, onReset }: ResultPageProps) {
  const handleDownload = () => {
    const url = window.URL.createObjectURL(pdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.replace('.xlsx', '.pdf')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="text-center space-y-4">
      <div className="bg-green-50 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">PDF Oluşturuldu!</h2>
        <p className="text-gray-600 mt-1">
          Verilen veriler ile PDF dosyası oluşturuldu.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
        <Button onClick={handleDownload} className="sm:w-auto">
          PDF indir
        </Button>
        <Button variant="outline" onClick={onReset} className="sm:w-auto">
          Yeni PDF oluştur
        </Button>
      </div>
    </div>
  )
}