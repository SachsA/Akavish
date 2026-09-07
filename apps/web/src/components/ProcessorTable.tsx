import { PROCESSORS } from '@/lib/legal'

const HEADERS = {
  en: { name: 'Service', data: 'What it receives', purpose: 'Why', region: 'Location' },
  fr: { name: 'Service', data: 'Ce qu’il reçoit', purpose: 'Pourquoi', region: 'Lieu' },
} as const

/**
 * Renders the processor list from `lib/legal.ts` in one language. Both the
 * English and French privacy pages use this, so the factual content is
 * guaranteed identical — only the surrounding prose is written twice.
 */
export function ProcessorTable({ lang }: { lang: 'en' | 'fr' }) {
  const h = HEADERS[lang]

  return (
    <div className="overflow-x-auto my-6">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-zinc-800 text-left">
            <th className="py-2 pr-4 font-bold text-white">{h.name}</th>
            <th className="py-2 pr-4 font-bold text-white">{h.data}</th>
            <th className="py-2 pr-4 font-bold text-white">{h.purpose}</th>
            <th className="py-2 font-bold text-white">{h.region}</th>
          </tr>
        </thead>
        <tbody>
          {PROCESSORS.map((p) => (
            <tr key={p.name} className="border-b border-zinc-900 align-top">
              <td className="py-3 pr-4 whitespace-nowrap">
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  {p.name}
                </a>
              </td>
              <td className="py-3 pr-4 text-zinc-400">{p.data[lang]}</td>
              <td className="py-3 pr-4 text-zinc-400">{p.purpose[lang]}</td>
              <td className="py-3 text-zinc-500 whitespace-nowrap">{p.region}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
