import { ImageOff } from "lucide-react";
import { ReactNode, useState } from "react";

// A stored image link can stop working (Instagram's links expire, files get
// removed). Show a placeholder then, instead of the browser's broken image
// and its alt text.
export function ImageWithFallback({
  src,
  alt,
  className,
  fallback
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return (
      <>
        {fallback ?? (
          <ImageOff
            className="size-5 text-muted-foreground"
            role="img"
            aria-label={alt}
          />
        )}
      </>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
