'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function SecurityUpdateForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    if (!username && !password) {
      toast({
        title: "Hata",
        description: "En az bir alan doldurulmalıdır.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const queryParams = new URLSearchParams()
    if (username) queryParams.append('username', username)
    if (password) queryParams.append('password', password)

    try {
      const response = await fetch(`/api/security?${queryParams.toString()}`)
      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Başarılı",
          description: "Bilgiler başarıyla güncellendi!",
        })
        setUsername('')
        setPassword('')
      } else {
        toast({
          title: "Hata",
          description: "Bilgiler güncellenirken bir hata oluştu. Tekrar deneyin.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Hata",
        description: "Bilgiler güncellenirken bir hata oluştu. Tekrar deneyin.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Panel Bilgilerini Güncelle</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Yeni Kullanıcı Adı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="Yeni Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'Güncelleniyor...' : 'Güncelle'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}