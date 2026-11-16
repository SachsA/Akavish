import { feedResponse } from '@/lib/feed'

// The English feed (lib/feed.ts). The French one is /fr/feed.xml.
export const revalidate = 300

export async function GET() {
  return feedResponse('en')
}
