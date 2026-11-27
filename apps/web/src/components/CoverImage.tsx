import Image from 'next/image'

// An article cover in a 16:9 box (cards, lead story, the article's top).
// A photo close to that shape fills the box, cropped around the focal point
// set in the CMS (the dot on the image in Media). A team logo, a square or tall
// picture, a panorama (`coverImageFit: 'contain'`, decided in
// packages/api-client `mediaFit`) is shown whole over a blurred, darkened copy
// of itself instead of being cut (2026-11-27: Lynn Vision's and Fire Flux's
// logos lost their names). So any image can be uploaded as a cover.

export function CoverImage({
  src,
  alt,
  fit,
  focus,
  sizes,
  preload,
  className = '',
}: {
  src: string
  alt: string
  fit?: 'contain'
  focus?: { x: number; y: number }
  sizes: string
  preload?: boolean
  /** Extra classes for the picture (spoiler blur, hover zoom). */
  className?: string
}) {
  if (fit !== 'contain') {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        className={`object-cover ${className}`}
        style={focus ? { objectPosition: `${focus.x}% ${focus.y}%` } : undefined}
      />
    )
  }
  return (
    <>
      {/* The same file (one download): the box's background. */}
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes={sizes}
        className={`object-cover scale-125 blur-2xl brightness-50 ${className}`}
      />
      <Image src={src} alt={alt} fill sizes={sizes} preload={preload} className={`object-contain p-[4%] ${className}`} />
    </>
  )
}
