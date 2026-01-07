import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="space-y-2">
                    <h1 className="text-6xl font-bold text-gray-300">404</h1>
                    <h2 className="text-2xl font-bold text-gray-900">
                        Sayfa Bulunamadı
                    </h2>
                    <p className="text-gray-600">
                        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
                    </p>
                </div>
                <Link
                    href="/"
                    className="inline-block w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                    Ana Sayfaya Dön
                </Link>
            </div>
        </div>
    )
}
