import { Title } from "~/components/title";

interface Props {
  title: string;
  description: string;
  /** Optional content rendered below the title (e.g. the global search field). */
  children?: React.ReactNode;
}

/**
 * Shared hero band used by both the global landing page and the localized
 * country pages, so they share one visual anchor. Server-rendered: it only
 * wraps the SSR `Title` and any children in a subtly tinted section. The tint
 * stays within the brand palette (a faint drossblue wash fading into the
 * drossgray page background).
 */
export function Hero({ title, description, children }: Props) {
  return (
    <section className="border-drossgray-dark/10 from-drossblue/[0.04] to-drossgray border-b bg-gradient-to-b pb-6">
      <Title title={title} description={description} />
      {children}
    </section>
  );
}
