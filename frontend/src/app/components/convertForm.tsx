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
  const [result, setResult] = useState<{
    downloadUrl: string
    fileName: string
    sizeMb?: number
    processingTime?: number
    pages?: number
  } | null>(null)
  const [progress, setProgress] = useState(0)
  const [displayedProgress, setDisplayedProgress] = useState(0)  // Yumuşak animasyon için
  const [elapsedSec, setElapsedSec] = useState(0)
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
      if (!response.ok) return null
      const data = await response.json()
      if (!data.total || data.total === 0) return null
      return Math.min(99, Math.round((data.current / data.total) * 100))
    } catch {
      return null
    }
  }

  const handleConvert = async () => {
    if (!file) return

    setIsConverting(true)
    setProgress(0)
    setDisplayedProgress(0)
    setElapsedSec(0)

    try {
      // Eski "isfree" gate kaldirildi. Backend multi-worker + async download
      // mimarisinde paralel isler kabul ediliyor; on kontrol gereksiz ve
      // bazi durumlarda 429 donup "Failed to fetch" hatasi yaratiyordu.
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

      if (!response.ok) {
        // Backend size limit (413) icin net mesaj goster; digerleri generic.
        let msg = 'PDF oluşturulurken bir hata oluştu.'
        try {
          const errBody = await response.json()
          if (response.status === 413 && errBody?.max_rows) {
            msg = `Çok fazla satır (${errBody.received}). Tek seferde en fazla ${errBody.max_rows} satır işlenebilir. Dosyayı bölerek deneyin.`
          } else if (errBody?.error) {
            msg = errBody.error
          }
        } catch { /* response body JSON değilse generic */ }
        throw new Error(msg)
      }

      // Backend artik bytes degil JSON doner:
      //   { filename, download_url, size_mb, processing_time_sec, pages, job_id }
      // download_url'i proxy endpoint'i uzerinden kullaniriz; kullanici "indir"e
      // bastiginda browser kendi download manager'i ile 24MB'i ceker — biz
      // aradaki Blob/arrayBuffer adimina girmiyoruz.
      const meta = await response.json()
      if (!meta.filename) throw new Error('PDF olusturuldu ama dosya adi eksik.')

      setProgress(100)
      // Kullanici dostu dosya adi: xlsx adindan turet, proxy'ye ?name= ile
      // ilet — browser bu adla indirir (backend filename token'li kalir).
      const friendlyName = file.name.replace(/\.xlsx$/i, '.pdf')
      setResult({
        downloadUrl: `/api/proxy/download/${encodeURIComponent(meta.filename)}?name=${encodeURIComponent(friendlyName)}`,
        fileName: file.name,
        sizeMb: meta.size_mb,
        processingTime: meta.processing_time_sec,
        pages: meta.pages,
      })
      toast({
        title: 'İşlem Tamamlandı',
        description: 'PDF başarıyla oluşturuldu.',
      })

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
    setResult(null)
    setProgress(0)
    setDisplayedProgress(0)
    setElapsedSec(0)
  }

  // Backend'den progress — hizli polling (500ms), ilk poll anında.
  // Geri dusmez; backend henuz is baslatmadiysa null doner, 0'da kalir.
  useEffect(() => {
    if (!isConverting) return
    let cancelled = false
    let maxSeen = 0
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      if (cancelled) return
      const p = await fetchProgress()
      if (!cancelled && p !== null && p > maxSeen) {
        maxSeen = p
        setProgress(p)
      }
      if (!cancelled) timeoutId = setTimeout(tick, 500)
    }
    tick()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isConverting])

  // Elapsed timer: her saniye guncel tutar (kullanici "hala calisiyor" anlasın).
  useEffect(() => {
    if (!isConverting) return
    const start = Date.now()
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [isConverting])

  // Smooth interpolation: displayedProgress ~60fps ile progress'e yaklasır.
  // Tick'ler arası donuk his biter; bar "nefes alir" gibi akar.
  // Ayrıca backend ilk veriyi gonderene kadar 0 -> 3'e yavas yavas kendi kendine
  // ilerler (kullanici "takıldı mı" diye düşünmesin).
  useEffect(() => {
    if (!isConverting) return
    let rafId: number
    let lastTime = performance.now()
    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      setDisplayedProgress((prev) => {
        const target = progress > 0 ? progress : Math.min(3, prev + dt * 1.5)
        const diff = target - prev
        if (Math.abs(diff) < 0.05) return target
        // Ease: saniyede mesafenin %250'si kadar ilerle (yumusak ama hizli).
        return prev + diff * Math.min(1, dt * 2.5)
      })
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [isConverting, progress])

  if (result) {
    return (
      <ResultPage
        fileName={result.fileName}
        downloadUrl={result.downloadUrl}
        sizeMb={result.sizeMb}
        processingTime={result.processingTime}
        pages={result.pages}
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
            className="w-full h-4"
          />
          <div className="flex items-center justify-between text-sm text-gray-700 tabular-nums">
            <span className="font-semibold">
              {progress === 0 ? 'Hazırlanıyor…' : `${Math.round(displayedProgress)}% Tamamlandı`}
            </span>
            <span className="text-gray-500">
              {Math.floor(elapsedSec / 60)}:{String(elapsedSec % 60).padStart(2, '0')}
            </span>
          </div>
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