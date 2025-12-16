import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5001'

export async function GET(request: NextRequest) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/progress`, {
            method: 'GET',
            headers: {
                'Authorization': request.headers.get('Authorization') || '',
            },
        })

        const data = await response.json()
        return NextResponse.json(data, { status: response.status })
    } catch (error) {
        console.error('Proxy error:', error)
        return NextResponse.json({ error: 'Backend connection failed' }, { status: 500 })
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { status: 200 })
}
