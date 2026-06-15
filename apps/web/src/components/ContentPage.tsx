// Shared wrapper for simple text pages (about, contact, legal).
export function ContentPage({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-black tracking-tight text-white">{title}</h1>
        {subtitle && <p className="text-zinc-400 mt-2">{subtitle}</p>}
      </header>
      <div className="space-y-4 text-zinc-300 leading-relaxed [&_h2]:text-white [&_h2]:font-bold [&_h2]:text-xl [&_h2]:mt-8 [&_h2]:mb-2 [&_a]:text-emerald-400 [&_a:hover]:text-emerald-300">
        {children}
      </div>
    </div>
  )
}
