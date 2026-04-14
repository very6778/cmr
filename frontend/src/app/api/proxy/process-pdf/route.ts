import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001'
const API_KEY = process.env.API_KEY || ''

// Route segment config: uzun PDF islerinde route'un kesilmesini engelle.
export const maxDuration = 600
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/process-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
            },
            body: JSON.stringify(body),
            // Client-side timeout backend'in 600s timeout'undan biraz dusuk.
            signal: AbortSignal.timeout(595_000),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Backend error' }))
            return NextResponse.json(error, { status: response.status })
        }

        // Stream PDF body'sini frontend'den Next.js proxy uzerinden dogrudan gec.
        // arrayBuffer() yerine body stream'i yeniden kullan: bellek ~0, buyuk
        // PDF'lerde OOM riski olusmaz.
        return new NextResponse(response.body, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="output.pdf"',
                'Cache-Control': 'no-store',
            },
        })
    } catch (error) {
        console.error('Proxy error:', error)
        const message = error instanceof Error ? error.message : 'Backend connection failed'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 })
}
