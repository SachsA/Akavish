import { NextRequest, NextResponse } from 'next/server'

// Placeholder handler — will be replaced by Payload CMS queries
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  // TODO: replace with Payload CMS findOne query
  return NextResponse.json(
    { message: `Article "${params.slug}" not found` },
    { status: 404 }
  )
}
