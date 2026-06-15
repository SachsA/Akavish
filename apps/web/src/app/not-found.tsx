import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center space-y-6">
      <p className="text-7xl font-black tracking-tight text-zinc-800">404</p>
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="text-zinc-400">
        This page doesn&apos;t exist, was moved, or the link is broken.
      </p>
      <div className="flex justify-center gap-3 pt-2">
        <Link
          href="/"
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
        >
          Back home
        </Link>
        <Link
          href="/news"
          className="px-4 py-2 rounded-md border border-zinc-800 text-zinc-300 text-sm font-semibold hover:border-zinc-700 transition-colors"
        >
          Latest news
        </Link>
      </div>
    </div>
  )
}
