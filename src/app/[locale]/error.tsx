"use client";

import { useEffect } from "react";

type Props = {
  error: Error & { digest?: string };
  reset(): void;
};

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // `flex` (not just `flex-col`) so the column layout and centering apply, and a
  // visible link colour (the previous `text-white` button was invisible on the
  // light page background).
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="mt-4">Something went wrong.</p>
      <button
        className="text-drossblue mt-2 underline underline-offset-2"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
