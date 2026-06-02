export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <section className="mb-12 text-center space-y-4">
        <h1 className="text-5xl font-black tracking-tight">
          <span className="text-white">AKV</span>
          <span className="text-zinc-600">ash</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Breaking gaming news, exclusive leaks, in-depth reviews. Fast. Serious. No fluff.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          {['CS2', 'GTA VI', "Baldur's Gate 3", 'Esport', 'Nintendo'].map((tag) => (
            <span key={tag} className="px-3 py-1 rounded-full border border-zinc-800 text-xs text-zinc-500">
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-zinc-600 mb-6 font-bold">Latest</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden animate-pulse">
              <div className="aspect-video bg-zinc-800" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-zinc-800 rounded w-16" />
                <div className="h-4 bg-zinc-800 rounded w-full" />
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
