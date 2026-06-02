import React from 'react'

export type BadgeVariant = 'news' | 'leak' | 'review' | 'preview' | 'conference' | 'esport'

const variantStyles: Record<BadgeVariant, string> = {
  news: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  leak: 'bg-red-500/20 text-red-400 border-red-500/30',
  review: 'bg-green-500/20 text-green-400 border-green-500/30',
  preview: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  conference: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  esport: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

interface BadgeProps {
  variant: BadgeVariant
  label?: string
  className?: string
}

export function Badge({ variant, label, className = '' }: BadgeProps) {
  const text = label ?? variant.toUpperCase()
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold uppercase tracking-wider ${variantStyles[variant]} ${className}`}
    >
      {text}
    </span>
  )
}
