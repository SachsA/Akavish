// Placeholder grid shown while a list of articles is loading.
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden animate-pulse"
        >
          <div className="aspect-video bg-zinc-800" />
          <div className="p-4 space-y-2">
            <div className="h-3 bg-zinc-800 rounded w-16" />
            <div className="h-4 bg-zinc-800 rounded w-full" />
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
