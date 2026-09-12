"use client";

import Image from "next/image";

export interface StoryCoverImageProps {
  src: string;
  alt: string;
  objectPosition: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}

/**
 * Renders local legacy covers and immutable R2 URLs through one client boundary.
 * The passthrough loader is intentionally kept here because functions cannot be
 * passed from a Server Component to next/image.
 */
export default function StoryCoverImage({
  src,
  alt,
  objectPosition,
  sizes,
  className = "object-cover",
  priority = false,
}: StoryCoverImageProps) {
  return (
    <Image
      loader={({ src: imageSrc }) => imageSrc}
      unoptimized
      priority={priority}
      fill
      src={src}
      alt={alt}
      className={className}
      style={{ objectPosition }}
      sizes={sizes}
    />
  );
}
