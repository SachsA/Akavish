export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 animate-pulse">
      <div className="h-4 w-16 bg-zinc-800 rounded mb-6" />
      <div className="space-y-3 mb-8">
        <div className="h-4 w-20 bg-zinc-800 rounded" />
        <div className="h-10 w-full bg-zinc-800 rounded" />
        <div className="h-10 w-2/3 bg-zinc-800 rounded" />
        <div className="h-5 w-3/4 bg-zinc-800 rounded" />
      </div>
      <div className="aspect-video bg-zinc-800 rounded-lg mb-8" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-4 bg-zinc-800 rounded w-full" />
        ))}
      </div>
    </div>
  )
}
