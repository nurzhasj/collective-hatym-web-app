"use client";

import { useEffect, useState } from "react";

export type MushafImageRendererProps = {
  src: string;
  pageNumber: number;
  className?: string;
};

function cx(...classes: Array<string | null | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export default function MushafImageRenderer({ src, pageNumber, className }: MushafImageRendererProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  if (hasError) {
    return (
      <div
        className={cx(
          "rounded-2xl border border-red-500/40 bg-red-50 p-5 text-center text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200",
          className
        )}
      >
        Failed to load mushaf image.
      </div>
    );
  }

  return (
    <div
      className={cx(
        "w-full overflow-auto rounded-[2rem] border border-stone-300/70 bg-stone-100/70 p-3 sm:p-5 dark:border-white/10 dark:bg-white/5",
        className
      )}
    >
      <div className="mx-auto w-full max-w-[900px] rounded-[1.5rem] border border-stone-300/80 bg-white p-2 shadow-sm dark:border-white/15 dark:bg-white/95 sm:p-3">
        <img
          src={src}
          alt={`Mushaf page ${pageNumber}`}
          loading="eager"
          decoding="async"
          onError={() => setHasError(true)}
          className="block h-auto w-full rounded-[1rem]"
        />
      </div>
    </div>
  );
}
