'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Download, Trash2, CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { useToast } from "@/hooks/use-toast"

interface HistoryItem {
  id: string
  originalName: string
  pdfName: string
  date: string
}

function HistoryList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [files, setFiles] = useState<HistoryItem[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch('/api/files');
        const data = await response.json();
        if (response.ok) {
          const formattedFiles = data.map((file: any) => ({
            id: file.name,
            originalName: file.name.replace('.pdf', '.xlsx'),
            pdfName: file.name,
            date: file.created_at,
          }));
          setFiles(formattedFiles);
        } else {
          console.error('Error fetching files:', data.error);
          toast({
            title: "Hata",
            description: "Dosyalar yüklenirken bir hata oluştu.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error('Error fetching files:', error);
        toast({
          title: "Hata",
          description: "Dosyalar yüklenirken bir hata oluştu.",
          variant: "destructive",
        })
      }
    };
    fetchFiles();
  }, [toast]);

  const filteredData = files.filter(item =>
    item.originalName.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!dateFilter || new Date(item.date).toDateString() === dateFilter.toDateString())
  )

  const handleDelete = async (filename: string) => {
    try {
      const response = await fetch('/api/files', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: filename,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log('File deleted:', data.message);
        setFiles(prevFiles => prevFiles.filter(file => file.id !== filename));
        toast({
          title: "Başarılı",
          description: "Dosya başarıyla silindi.",
        });
      } else {
        console.error('Error deleting file:', data.error);
        toast({
          title: "Hata",
          description: "Dosya silinirken bir hata oluştu: " + (data.error || "Bilinmeyen hata"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: "Hata",
        description: "Dosya silinirken bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: filename,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('File ready for download:', data.download_url);
        window.open(data.download_url, '_blank');
        toast({
          title: "Başarılı",
          description: "Dosya indirme işlemi başlatıldı.",
        });
      } else {
        console.error('Error preparing file for download:', data.error);
        toast({
          title: "Hata",
          description: "Dosya indirilirken bir hata oluştu: " + (data.error || "Bilinmeyen hata"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error preparing file for download:', error);
      toast({
        title: "Hata",
        description: "Dosya indirilirken bir hata oluştu. Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <Input
          placeholder="Dosya adı ile ara"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[240px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter ? format(dateFilter, 'PPP') : <span>Bir tarih seçin</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={setDateFilter}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      {files.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg font-semibold">Henüz dosya yok</p>
          <p className="text-sm text-gray-500">Dönüştürülen dosyalar burada görünecek</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Excel</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.originalName}</TableCell>
                  <TableCell>{item.pdfName}</TableCell>
                  <TableCell>{format(new Date(item.date), 'PPP')}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => handleDownload(item.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Download className="h-4 w-4" />
                        <span className="sr-only">İndir</span>
                      </Button>
                      <Button
                        onClick={() => handleDelete(item.id)}
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:bg-destructive/90 hover:text-destructive-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Sil</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export default HistoryList