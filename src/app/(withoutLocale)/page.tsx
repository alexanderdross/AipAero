import { Header } from "~/app/_components/header";
import { Box } from "~/app/_components/box";
import Link from "next/link";

const elements = [
  {
    title: "AIP Germany",
    flag: "🇩🇪",
    country: "Germany",
    subtitle: "Browse AIP of Germany and download airport approach charts",
    buttons: [
      {
        title: "AIP Germany in English",
        href: "/de/en/",
      },
      {
        title: "AIP Deutschland in Deutsch",
        href: "/de/",
      },
    ],
  },
  {
    title: "AIP Austria",
    flag: "🇦🇹",
    country: "Austria",
    subtitle: "Browse AIP of Austria and download airport approach charts",
    buttons: [
      {
        title: "AIP Austria in English",
        href: "/at/en/",
      },
      {
        title: "AIP Österreich in Deutsch",
        href: "/at/",
      },
    ],
  },
  {
    title: "AIP Netherlands",
    flag: "🇳🇱",
    country: "the Netherlands",
    subtitle:
      "Browse AIP of the Netherlands and download airport approach charts",
    buttons: [
      {
        title: "AIP Netherlands in English",
        href: "/nl/en/",
      },
      {
        title: "AIP Nederland in het Nederlands",
        href: "/nl/",
      },
    ],
  },
  {
    title: "AIP United Kingdom",
    flag: "🇬🇧",
    country: "the UK",
    subtitle:
      "Browse AIP of the United Kingdom and download airport approach charts",
    buttons: [
      {
        title: "AIP United Kingdom in English",
        href: "/uk/",
      },
    ],
  },
];

export default async function Home() {
  return (
    <>
      <Header title={"AIP and approach charts of Germany, Austria, the Netherlands"}
        subtitle="Free download of Aeronautical Information Publication (AIP) and
        approach charts of aerodromes/ airports/ airfields in Germany, Austria, the Netherlands."
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul role="list" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {elements.map((e) => (
            <Box
              key={e.title}
              title={e.title}
              subtitle={e.subtitle}
              flag={e.flag}
              buttons={e.buttons}
            />
          ))}
        </ul>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-center items-center text-center mt-16">
          <div className="border border-[#ccc] p-4">
            <h3 className="!text-[1.125rem] font-medium">About this website</h3>
            <p>This website aims to simplify the search for approach charts and Aeronautical Information Publication (AIP) for aerodromes, airports, and airfields in {
              elements.map((e, idx) => (<span key={e.country}>
                <Link className="text-drossblue hover:underline" href={e.buttons.at(-1)?.href ?? '#'} title={`Aeronautical Information Publication (AIP) of ${e.country}`}>{e.country}</Link>
                {idx <= elements.length - 2 ? idx === elements.length - 2 ? ' and ' : ', ' : ''}
              </span>
              ))}. We are not liable for the correctness and accuracy of AIPs (Aeronautical Information Publication), as these are not operated by us. We merely provide convenient links to corresponding approach charts.</p>
          </div>
        </div>
      </div>
    </>
  );
}
