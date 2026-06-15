import { CardGridSkeleton } from '@/components/CardGridSkeleton'

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-10 space-y-3">
        <div className="h-9 w-48 bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-72 max-w-full bg-zinc-800 rounded animate-pulse" />
      </div>
      <CardGridSkeleton count={6} />
    </div>
  )
}
