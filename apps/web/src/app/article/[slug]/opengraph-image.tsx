import { ImageResponse } from 'next/og'
import { fetchArticleBySlug } from '@/lib/payload'

export const runtime = 'nodejs'
export const revalidate = 300

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const CATEGORY_LABELS: Record<string, string> = {
  news: 'News',
  leak: 'Leak',
  review: 'Review',
  preview: 'Preview',
  conference: 'Conference',
  esport: 'Esport',
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await fetchArticleBySlug(slug).catch(() => null)

  const title = article?.title ?? 'Akavish'
  const category = article ? (CATEGORY_LABELS[article.category] ?? article.category) : ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#09090b',
          padding: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 40, fontWeight: 900, color: '#ffffff' }}>AKV</span>
          <span style={{ fontSize: 40, fontWeight: 900, color: '#52525b' }}>ash</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {category && (
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 2,
                color: '#10b981',
              }}
            >
              {category}
            </span>
          )}
          <span
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.1,
              // Clamp very long titles.
              display: 'flex',
            }}
          >
            {title.length > 90 ? `${title.slice(0, 90)}…` : title}
          </span>
        </div>

        <span style={{ fontSize: 26, color: '#71717a' }}>akavish.gg</span>
      </div>
    ),
    { ...size }
  )
}
