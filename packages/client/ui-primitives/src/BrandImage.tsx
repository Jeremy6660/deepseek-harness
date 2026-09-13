import clsx from 'clsx'
import css from './BrandImage.module.css'

/** Display options for a publisher-provided raster brand mark. */
export interface BrandImageProps {
  /** Image source; a local `data:image/png;base64,` URI, never a remote URL. */
  src: string
  /** Accessible description of the mark; unlike decorative icons, this is meaningful. */
  alt: string
  /** Square edge in px; when omitted the image renders at its natural size. */
  size?: number | undefined
  /** Extra class for layout placement. */
  className?: string | undefined
}

/**
 * Render a publisher-provided raster brand mark.
 * @param props.src - local data-URI image source (no remote content).
 * @param props.alt - accessible label for the image.
 * @param props.size - square edge in px (defaults to the image's natural size).
 * @param props.className - extra class for layout placement.
 * @returns the `<img>` element.
 */
export function BrandImage({ src, alt, size, className }: BrandImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={clsx(css.image, className)}
    />
  )
}
