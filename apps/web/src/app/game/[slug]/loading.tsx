import { CardGridSkeleton } from '@/components/CardGridSkeleton'

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row gap-6 mb-10">
        <div className="w-full sm:w-48 aspect-[3/4] bg-zinc-800 rounded-lg animate-pulse shrink-0" />
        <div className="space-y-3 flex-1">
          <div className="h-9 w-56 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-40 bg-zinc-800 rounded animate-pulse" />
        </div>
      </div>
      <CardGridSkeleton count={6} />
    </div>
  )
}
