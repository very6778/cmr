'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Upload, FileSpreadsheet, X } from 'lucide-react'
import { ResultPage } from './resultPage'
import ExcelJS from 'exceljs'
import { Progress } from '@/components/ui/progress'

const API_URL = process.env.NEXT_PUBLIC_API_URL
const API_KEY = process.env.NEXT_PUBLIC_API_KEY

export function ConvertForm() {
  const [file, setFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null)
  const [progress, setProgress] = useState(0)
  const [displayedProgress, setDisplayedProgress] = useState(0)  // Yumuşak animasyon için
  const [currency, setCurrency] = useState<string>('$')
  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const selectedFile = acceptedFiles[0]
    if (selectedFile && selectedFile.name.endsWith('.xlsx')) {
      setFile(selectedFile)
    } else {
      toast({
        title: 'Geçersiz Dosya Formatı',
        description: 'Lütfen XLSX uzantılı bir dosya yükleyiniz.',
        variant: 'destructive',
      })
    }
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    multiple: false
  })

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/proxy/progress', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      })
      if (!response.ok) throw new Error('Failed to fetch progress')
      const data = await response.json()
      if (!data.total || data.total === 0) return 0
      return Math.round((data.current / data.total) * 100)
    } catch (error) {
      console.error('Error fetching progress:', error)
      return null
    }
  }

  const handleConvert = async () => {
    if (!file) return

    setIsConverting(true)
    setProgress(0)

    try {
      const isFree = await fetch('/api/proxy/isfree', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      })
      if (!isFree.ok) throw new Error('Failed to fetch progress')

      const workbook = new ExcelJS.Workbook()
      const fileData = await file.arrayBuffer()
      await workbook.xlsx.load(fileData)

      const worksheet = workbook.getWorksheet(1)

      if (!worksheet) {
        throw new Error('Excel dosyasında geçerli bir tablo bulunamadı.')
      }

      const jsonData: Record<string, any>[] = []
      const headerRow = worksheet.getRow(1)

      if (!headerRow) {
        throw new Error('Tabloda başlık eksik veya yok.')
      }

      worksheet.eachRow((row, rowIndex) => {
        if (rowIndex === 1) return
        const rowData: Record<string, any> = {}
        row.eachCell((cell, colIndex) => {
          const headerCell = headerRow.getCell(colIndex)
          const header = headerCell.value?.toString() || `Column${colIndex}`

          // Akıllı formatlama: Sadece sayıları yuvarla, stringleri olduğu gibi bırak
          let value = cell.value
          if (typeof value === 'number') {
            // Ondalıklı sayıları 2 haneye yuvarla
            value = Number(value.toFixed(2))
          }
          rowData[header] = value
        })
        jsonData.push(rowData)
      })

      const response = await fetch('/api/proxy/process-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({ data: jsonData, currency: currency }),
      })

      if (!response.ok) throw new Error('PDF oluşturulurken bir hata oluştu.')

      const pdfBuffer = await response.arrayBuffer()
      const newPdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' })
      setPdfBlob(newPdfBlob)
      toast({
        title: 'İşlem Tamamlandı',
        description: 'PDF başarıyla oluşturuldu.',
      })

      // Progress'i 100'e çıkar ve animasyonun tamamlanmasını bekle
      setProgress(100)
      await new Promise(resolve => setTimeout(resolve, 600)) // Animasyon tamamlansın

    } catch (error) {
      console.error('Conversion failed:', error)
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'PDF oluşturulurken bir hata oluştu. Tekrar deneyin.',
        variant: 'destructive',
      })
    } finally {
      setIsConverting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setPdfBlob(null)
    setProgress(0)
    setDisplayedProgress(0)
  }

  // Backend'den progress al - tek useEffect ile optimize edildi
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    let isMounted = true

    if (isConverting) {
      intervalId = setInterval(async () => {
        if (!isMounted) return
        const currentProgress = await fetchProgress()
        if (currentProgress !== null && isMounted) {
          setProgress(currentProgress)
          setDisplayedProgress(currentProgress)
        }
      }, 1500) // 1.5 saniye - daha az yük
    }

    return () => {
      isMounted = false
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isConverting])

  if (pdfBlob) {
    return (
      <ResultPage
        fileName={file?.name || 'converted.pdf'}
        pdfBlob={pdfBlob}
        onReset={handleReset}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary'
          }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileSpreadsheet className="h-8 w-8 text-primary" />
            <span className="text-sm text-gray-600">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={(e) => {
                e.stopPropagation()
                setFile(null)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div>
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">
              Bir XLSX dosyası sürükleyin veya seçin
            </p>
          </div>
        )}
      </div>
      {isConverting && (
        <div className="space-y-2">
          <Progress
            value={displayedProgress}
            className="w-full h-4 transition-all duration-300 ease-out"
          />
          <p className="text-sm font-semibold text-gray-700 text-center tabular-nums">
            {displayedProgress}% Tamamlandı
          </p>
        </div>
      )}

      {/* Currency Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setCurrency('$')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${currency === '$'
              ? 'bg-primary text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            $ USD
          </button>
          <button
            type="button"
            onClick={() => setCurrency('€')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${currency === '€'
              ? 'bg-primary text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            € EUR
          </button>
          <button
            type="button"
            onClick={() => setCurrency('₺')}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 ${currency === '₺'
              ? 'bg-primary text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            ₺ TRY
          </button>
        </div>
      </div>

      <Button
        onClick={handleConvert}
        disabled={!file || isConverting}
        className="w-full"
      >
        {isConverting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Oluşturuluyor...
          </>
        ) : (
          'PDF Oluştur'
        )}
      </Button>
    </div>
  )
}