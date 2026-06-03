import { NextRequest, NextResponse } from 'next/server'
import { fetchArticleBySlug } from '@/lib/payload'

// Returns a single published article by slug from the Payload CMS.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const article = await fetchArticleBySlug(slug)
    if (!article) {
      return NextResponse.json(
        { message: `Article "${slug}" not found`, status: 404 },
        { status: 404 }
      )
    }
    return NextResponse.json(article)
  } catch {
    return NextResponse.json(
      { message: 'Failed to load article from CMS', status: 502 },
      { status: 502 }
    )
  }
}
