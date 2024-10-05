import type { Translation } from "~/lib/i18n";
import richText from "~/app/_components/rich-text";
import { ExternalLink } from "~/app/_components/external-link";

export default function About({ translation, titleAs="h3" }: { translation: Translation["About"], titleAs?: string }) {
  const CustomTag = `${titleAs}` as keyof React.JSX.IntrinsicElements;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-center items-center text-center mt-16">
        <div className="border border-[#ccc] p-4">
          <CustomTag className="!text-[1.125rem] font-medium">{translation.title}</CustomTag>
          <p>{richText(translation.description, {
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