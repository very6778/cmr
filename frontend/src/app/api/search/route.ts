import { NextResponse } from 'next/server';

const history = false

export async function GET() {
  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request) {
  return NextResponse.json([]);
}