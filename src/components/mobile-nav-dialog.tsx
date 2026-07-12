"use client";

import * as React from "react";

type Props = {
  /** Accessible name for the hamburger button and the dialog ("Menu"). */
  label: string;
  /** Accessible name for the close button. */
  closeLabel: string;
  /** Server-rendered navigation (links stay in the SSR HTML while closed). */
  children: React.ReactNode;
};

/**
 * Mobile navigation as a native `<dialog>` bottom sheet.
 *
 * Replaces the former vaul drawer: no dependency in the shared bundle, and -
 * unlike a portal that mounts on open - the nav links are always part of the
 * server-rendered HTML (mobile-first indexing sees a real `<nav>`). The
 * browser provides focus trap, ESC handling and the backdrop via
 * `showModal()`; the entry animation is pure CSS (`@starting-style` via the
 * `starting:` variant, no-op on browsers without support and disabled for
 * reduced motion). Body scroll locking lives in globals.css
 * (`body:has(dialog:modal)`).
 */
export function MobileNavDialog({ label, closeLabel, children }: Props) {
  const ref = React.useRef<HTMLDialogElement>(null);

  const onDialogClick = React.useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Clicks on ::backdrop are dispatched with the dialog itself as target
    // (the sheet's content covers the whole element, so this can only be the
    // backdrop). Link clicks close the sheet before client-side navigation
    // swaps the page under it.
    if (target === ref.current || target.closest("a")) {
      ref.current?.close();
    }
  }, []);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
        // 48x48 tap target (WCAG 2.5.5 / Lighthouse); the negative margin
        // keeps the visual density of the old 32px button in the h-14 row.
        className="-mr-2 flex h-12 w-12 items-center justify-center rounded-md lg:hidden"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="size-6"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 9h16.5m-16.5 6.75h16.5"
          />
        </svg>
        <span className="sr-only">{label}</span>
      </button>
      <dialog
        ref={ref}
        aria-label={label}
        onClick={onDialogClick}
        className="inset-x-0 bottom-0 m-0 mt-auto max-h-[70svh] w-full max-w-none translate-y-0 rounded-t-[10px] border bg-white p-0 transition-transform duration-300 backdrop:bg-black/60 motion-reduce:transition-none starting:translate-y-full"
      >
        <div className="flex items-center justify-between pt-2 pr-2 pb-1 pl-6">
          <p className="font-semibold" aria-hidden="true">
            {label}
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={closeLabel}
            className="flex h-12 w-12 items-center justify-center rounded-md"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="size-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 6l12 12M6 18L18 6"
              />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </dialog>
    </>
  );
}
