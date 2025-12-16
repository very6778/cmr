'use server'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const response = await fetch(`${BACKEND_URL}/process-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': request.headers.get('Authorization') || '',
            },
            body: JSON.stringify(body),
        })

        if (!response.ok) {
            const error = await response.json()
            return NextResponse.json(error, { status: response.status })
        }

        // PDF binary döndür
        const pdfBuffer = await response.arrayBuffer()
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="output.pdf"',
            },
        })
    } catch (error) {
        console.error('Proxy error:', error)
        return NextResponse.json({ error: 'Backend connection failed' }, { status: 500 })
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 })
}
