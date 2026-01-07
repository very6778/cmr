'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log error to console (could be sent to error tracking service)
        console.error('Application error:', error)
    }, [error])

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-gray-900">
                        Bir Hata Oluştu
                    </h2>
                    <p className="text-gray-600">
                        Beklenmedik bir hata meydana geldi. Lütfen tekrar deneyin.
                    </p>
                </div>
                <Button
                    onClick={() => reset()}
                    className="w-full"
                >
                    Tekrar Dene
                </Button>
            </div>
        </div>
    )
}
