import type { CSSProperties } from "react";

/**
 * PassOn logo.
 *
 * Two variants are exported as static assets alongside this component:
 *  - "full": the full lockup (icon + "pass on" wordmark)
 *  - "mark": just the icon (two hands passing a document), for compact
 *    spots like a header, a favicon-sized badge, or a sidebar
 *
 * Both are transparent PNGs (with a WebP alternative for smaller payloads)
 * so they can sit on any background color.
 *
 * This component uses a plain <picture>/<img> pair rather than
 * next/image, so it drops into any React setup (Next.js, Vite, CRA, ...)
 * without extra config. If you're in Next.js and want automatic
 * optimization/responsive sizing, swap the <img> below for next/image
 * and pass the same src paths.
 */

export type PassOnLogoVariant = "full" | "mark";

const assets: Record<
  PassOnLogoVariant,
  { png: string; webp: string; width: number; height: number }
> = {
  full: {
    png: "/logo/logo-full.png",
    webp: "/logo/logo-full.webp",
    width: 987,
    height: 862,
  },
  mark: {
    png: "/logo/logo-mark.png",
    webp: "/logo/logo-mark.webp",
    width: 983,
    height: 582,
  },
};

export interface PassOnLogoProps {
  /** Which lockup to render. Defaults to "full". */
  variant?: PassOnLogoVariant;
  /** Rendered height in pixels; width is derived from the asset's aspect ratio. */
  height?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible label. Pass "" to mark the logo as purely decorative. */
  alt?: string;
}

export function PassOnLogo({
  variant = "full",
  height = 40,
  className,
  style,
  alt = "PassOn",
}: PassOnLogoProps) {
  const asset = assets[variant];
  const width = Math.round((asset.width / asset.height) * height);

  return (
    <picture>
      <source srcSet={asset.webp} type="image/webp" />
      <img
        src={asset.png}
        width={width}
        height={height}
        alt={alt}
        className={className}
        style={{ height, width, objectFit: "contain", ...style }}
      />
    </picture>
  );
}
