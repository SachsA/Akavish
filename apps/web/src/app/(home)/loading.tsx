// Skeleton for the home page. Mirrors the real layout in page.tsx (masthead,
// lead story + top-stories column) so content slots in without the page jumping.
// Keep the two in step when the home layout changes.

function Bar({ className }: { className: string }) {
  return <div className={`bg-zinc-800 rounded animate-pulse ${className}`} />
}

export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-zinc-800 pb-8">
        <div className="space-y-3">
          <Bar className="h-12 w-48" />
          <Bar className="h-4 w-80 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Bar key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <Bar className="aspect-video w-full rounded-lg" />
          <Bar className="h-8 w-3/4" />
          <Bar className="h-4 w-full" />
        </div>
        <div className="space-y-6">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-3 w-16" />
              <Bar className="h-5 w-full" />
              <Bar className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
