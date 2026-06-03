import { NextRequest, NextResponse } from 'next/server'
import type { ArticleCategory } from '@akavish/types'
import { fetchArticles } from '@/lib/payload'

// Proxies published articles from the Payload CMS REST API.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') ?? 1)
  const limit = Number(searchParams.get('perPage') ?? searchParams.get('limit') ?? 20)
  const category = searchParams.get('category') ?? undefined

  try {
    const result = await fetchArticles({
      page,
      limit,
      category: (category as ArticleCategory) ?? undefined,
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { message: 'Failed to load articles from CMS', status: 502 },
      { status: 502 }
    )
  }
}
