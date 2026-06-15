import { CardGridSkeleton } from '@/components/CardGridSkeleton'

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center gap-5 mb-10">
        <div className="w-20 h-20 rounded-full bg-zinc-800 animate-pulse" />
        <div className="space-y-3">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-72 max-w-full bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <CardGridSkeleton count={6} />
    </div>
  )
}
