import { LinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "~/components/ui/skeleton";

export default async function LoadingList() {
  const t = await getTranslations('AirportsPage');

  const items = [
    { title: t('vfrCard.title'), description: t('vfrCard.description') },
    t.has('ifrCard') && { title: t('ifrCard.title'), description: t('ifrCard.description') },
    { title: t('heliportCard.title'), description: t('heliportCard.description') },
  ].filter(x => x !== false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap justify-center gap-6">
        {items.map((item) => (
          <div key={item.title} className="bg-white py-8 px-6 border border-[#ccc] flex-grow basis-0 min-w-80">
            <h2 className="text-center text-2xl font-normal">{item.title}</h2>
            <p className="text-center pb-2">{item.description}</p>
            <ol>
              {[...Array(25).keys()].map((airport, index) => (
                <li
                  key={index}
                  itemScope
                  itemType="https://schema.org/Airport"
                  className="flex items-center gap-x-4"
                >
                  <span>{index + 1}.</span>
                  <div className="text-drossblue py-2 flex gap-x-2 justify-left hover:underline">
                    <LinkIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                    <Skeleton className="h-6 w-[200px]" />
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}