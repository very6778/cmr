import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001'

export const maxDuration = 600
export const dynamic = 'force-dynamic'

// Browser -> /api/proxy/download/<file> -> backend /api/download/<file>
// Public (auth yok). Backend kendisi filename formatini ve path traversal'i kontrol eder.
// Response'u stream olarak forward ederiz (bellekte buffer yok, buyuk PDF'lerde OOM yok).
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ filename: string }> }
) {
    try {
        const { filename } = await context.params
        // Basit frontend-side sanity check; asil validation backend'de.
        if (!/^out_[\w\-.]+_[a-f0-9]{8}\.pdf$/.test(filename)) {
            return NextResponse.json({ error: 'invalid filename' }, { status: 400 })
        }

        const upstream = await fetch(`${BACKEND_URL}/api/download/${encodeURIComponent(filename)}`, {
            method: 'GET',
            signal: AbortSignal.timeout(595_000),
        })

        if (!upstream.ok) {
            const err = await upstream.json().catch(() => ({ error: 'upstream error' }))
            return NextResponse.json(err, { status: upstream.status })
        }

        // Browser'in native download manager'i akisini yonetsin.
        return new NextResponse(upstream.body, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'public, max-age=3600',
            },
        })
    } catch (error) {
        console.error('Download proxy error:', error)
        return NextResponse.json({ error: 'download failed' }, { status: 500 })
    }
}
