import { NextRequest, NextResponse } from 'next/server'
import type { PaginatedResponse, Article } from '@akavish/types'

// Placeholder handler — will be replaced by Payload CMS queries
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') ?? 1)
  const perPage = Number(searchParams.get('perPage') ?? 20)

  // TODO: replace with Payload CMS collection query
  const mockResponse: PaginatedResponse<Article> = {
    data: [],
    total: 0,
    page,
    perPage,
    totalPages: 0,
  }

  return NextResponse.json(mockResponse)
}
