'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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

interface HistoryItem {
  id: string
  originalName: string
  pdfName: string
  date: Date
}

const mockData: HistoryItem[] = [
  { id: '1', originalName: 'report.xlsx', pdfName: 'report.pdf', date: new Date('2023-07-01') },
  { id: '2', originalName: 'data.xlsx', pdfName: 'data.pdf', date: new Date('2023-07-02') },
  { id: '3', originalName: 'analysis.xlsx', pdfName: 'analysis.pdf', date: new Date('2023-07-03') },
]

export function HistoryList() {
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined)
  const [selectedItems, setSelectedItems] = useState<string[]>([])

  const filteredData = mockData.filter(item =>
    item.originalName.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (!dateFilter || item.date.toDateString() === dateFilter.toDateString())
  )

  const handleSelect = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    setSelectedItems(selectedItems.length === filteredData.length ? [] : filteredData.map(item => item.id))
  }

  const handleDelete = () => {
    // In a real application, you would call an API to delete the selected items
    console.log('Deleting items:', selectedItems)
    setSelectedItems([])
  }

  const handleDownload = () => {
    // In a real application, you would initiate downloads for the selected items
    console.log('Downloading items:', selectedItems)
  }

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
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <Button onClick={handleDelete} disabled={selectedItems.length === 0} variant="destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Seçimi sil
        </Button>
        <Button onClick={handleDownload} disabled={selectedItems.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Seçimi indir
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedItems.length === filteredData.length}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>Excel</TableHead>
              <TableHead>PDF</TableHead>
              <TableHead>Tarih</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => handleSelect(item.id)}
                  />
                </TableCell>
                <TableCell>{item.originalName}</TableCell>
                <TableCell>{item.pdfName}</TableCell>
                <TableCell>{format(item.date, 'PPP')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

