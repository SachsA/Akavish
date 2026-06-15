import { CardGridSkeleton } from '@/components/CardGridSkeleton'

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="mb-12 flex flex-col items-center gap-4">
        <div className="h-12 w-40 bg-zinc-800 rounded animate-pulse" />
        <div className="h-4 w-80 max-w-full bg-zinc-800 rounded animate-pulse" />
      </div>
      <CardGridSkeleton count={6} />
    </div>
  )
}
