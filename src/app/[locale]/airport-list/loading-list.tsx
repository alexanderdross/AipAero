import { LinkIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "~/components/ui/skeleton";

export default async function LoadingList() {
  const t = await getTranslations("AirportsPage");

  const items = [
    t.has("vfrCard") && {
      title: t("vfrCard.title"),
      description: t("vfrCard.description"),
    },
    t.has("ifrCard") && {
      title: t("ifrCard.title"),
      description: t("ifrCard.description"),
    },
    t.has("heliportCard") && {
      title: t("heliportCard.title"),
      description: t("heliportCard.description"),
    },
    t.has("aeroportCard") && {
      title: t("aeroportCard.title"),
      description: t("aeroportCard.description"),
    },
    t.has("militaryCard") && {
      title: t("militaryCard.title"),
      description: t("militaryCard.description"),
    },
  ].filter((x) => x !== false);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap justify-center gap-6">
        {items.map((item) => (
          <div
            key={item.title}
            className="min-w-80 flex-grow basis-0 border border-[#ccc] bg-white px-6 py-8"
          >
            <h2 className="text-center text-2xl font-normal">{item.title}</h2>
            <p className="pb-2 text-center">{item.description}</p>
            <ol>
              {[...Array(25).keys()].map((_, index) => (
                <li key={index} className="flex items-center gap-x-4">
                  <span>{index + 1}.</span>
                  <div className="justify-left flex gap-x-2 py-2 text-drossblue hover:underline">
                    <LinkIcon
                      className="h-5 w-5 flex-shrink-0"
                      aria-hidden="true"
                    />
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
