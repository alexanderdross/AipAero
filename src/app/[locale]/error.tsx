'use client';

import { useEffect } from 'react';

type Props = {
  error: Error;
  reset(): void;
};

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div>
      <p className="mt-4">There was an error</p>
      <button
        className="text-white underline underline-offset-2"
        onClick={reset}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}