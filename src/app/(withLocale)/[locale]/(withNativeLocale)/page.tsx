import clsx from 'clsx';
import {useMessages, useTranslations} from 'next-intl';
import {unstable_setRequestLocale} from 'next-intl/server';
import { Box } from '~/app/_components/box';
import { Header } from '~/app/_components/header';

type Props = {
  params: {locale: string};
};

export default function IndexPage({params: {locale}}: Props) {
  // Enable static rendering
  unstable_setRequestLocale(locale);

  const t = useTranslations('IndexPage.native');
  const messages = useMessages();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
  const keys = Object.keys(messages.IndexPage?.native.boxes);

  return (
    <>
      <Header title={t('title')} subtitle={t('subtitle')} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ul role="list" className={clsx("grid grid-cols-1 gap-6 sm:grid-cols-2", keys.length >=3 && "lg:grid-cols-3")}>
          {keys.map((key) => (
            <Box
              key={key}
              title={t(`boxes.${key}.title`)}
              subtitle={t(`boxes.${key}.subtitle`)}
              buttons={[{href: t(`boxes.${key}.href`), title: t(`boxes.${key}.hrefTitle`), name: t(`boxes.${key}.hrefName`)}]}
            />
          ))}
        </ul>
      </div>
    </>
  );
}