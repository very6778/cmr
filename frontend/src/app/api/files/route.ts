const history = false

export async function GET() { // List
  return new Response(JSON.stringify([]), { status: 200 });
}

export async function DELETE(req: Request) { // Delete
  return new Response(JSON.stringify({}), { status: 200 });
}

export async function POST(req: Request) { // Download
  return new Response(JSON.stringify({}), { status: 200 });
}
