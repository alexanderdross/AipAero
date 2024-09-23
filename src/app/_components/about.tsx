import type { Translation } from "~/lib/i18n";
import rich from "~/app/_components/rich";
import { ExternalLink } from "~/app/_components/external-link";

export default function About({ translation }: { translation: Translation["About"] }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-center items-center text-center mt-16">
        <div className="border border-[#ccc] p-4">
          <h3 className="!text-[1.125rem] font-medium">{translation.title}</h3>
          <p>{rich(translation.description, {
            aip: (chunk) => <ExternalLink
              className="text-drossblue hover:underline"
              href={translation.aipHref}
              hrefTitle={translation.aipHrefTitle}
            >
              {chunk}
            </ExternalLink>
          })}</p>
        </div>
      </div>
    </section>
  );
}