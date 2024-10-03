import type { Translation } from "~/lib/i18n";
import { ExternalLink } from "~/app/_components/external-link";

export default function Footer({ translation }: { translation: Translation["Footer"] }) {
  const middlepart = translation.slice(1, -1);
  
  return (
    <footer className="bg-drossgray">
      <div className="max-w-7xl mx-auto py-8 px-4 overflow-hidden sm:px-6 lg:px-8">
        <div className="px-5 py-2 flex justify-center">
          <ExternalLink
            href={translation.at(0)?.title ?? ''}
            hrefTitle={translation.at(0)?.hrefTitle ?? ''}
            className="text-base text-drossblue hover:underline"
          >
            {translation.at(0)?.title}
          </ExternalLink>
        </div>
        <div className="flex flex-wrap justify-center" aria-label="Footer">
          {middlepart.map((item, idx) => (
            <span key={idx}>
              <ExternalLink
              href={item.href}
              hrefTitle={item.hrefTitle}
              className="text-base text-drossblue hover:underline mx-2"
            >
              {item.title}
            </ExternalLink>{idx < middlepart.length - 1 && '|'}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-base text-drossgray-dark">&copy; 2024 made with ♥ by{" "}
          <ExternalLink
            href={translation.at(-1)?.href ?? ''}
            hrefTitle={translation.at(-1)?.hrefTitle ?? ''}
            className="text-drossblue hover:underline"
          >
            {translation.at(-1)?.title}
          </ExternalLink></p>
      </div>
    </footer>
  )
}