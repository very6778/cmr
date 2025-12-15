import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.json(
    { message: 'Profile update not supported in local mode' },
    { status: 200 }
  );
}
