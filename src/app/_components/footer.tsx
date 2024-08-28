import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations('Footer');

  const navigation = {
    main: [
      { name: t('Stratux.name'), title: t('Stratux.title'), href: t('Stratux.href') },
      { name: t('Home.name'), title: t('Home.title'), href: t('Home.href') },
      { name: t('Imprint.name'), title: t('Imprint.title'), href: t('Imprint.href') },
      { name: t('Contact.name'), title: t('Contact.title'), href: t('Contact.href') },
      { name: t('Privacy.name'), title: t('Privacy.title'), href: t('Privacy.href') },
    ]
  }

  return (
    <footer className="bg-white">
      <div className="max-w-7xl mx-auto py-12 px-4 overflow-hidden sm:px-6 lg:px-8">
        <nav className="-mx-5 -my-2 flex flex-wrap justify-center" aria-label="Footer">
          {navigation.main.map((item) => (
            <div key={item.name} className="px-5 py-2">
              <a
                href={item.href}
                title={item.title}
                target="_blank"
                rel="noopener"
                className="text-base text-gray-500 hover:text-gray-900"
              >
                {item.name}
              </a>
            </div>
          ))}
        </nav>
        <p className="mt-8 text-center text-base text-gray-400">&copy; 2024 made with ♥ by{" "}
          <a
            href={t('Alexander.href')}
            rel="noopener"
            title={t('Alexander.title')}
            target="_blank"
            className="text-gray-400 hover:text-gray-500"
          >
            {t('Alexander.name')}
          </a></p>
      </div>
    </footer>
  )
}