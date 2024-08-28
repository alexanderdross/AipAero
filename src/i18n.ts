import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';
import {locales} from './config';
import { headers } from 'next/headers';

async function getConfig(locale: string) {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) notFound();

  return {
    messages: (await import(`../messages/${locale}.json`)).default
  };
}

export default getRequestConfig(async (params) => {
  // Read a hint that was set in the middleware
  const isMain = headers().get('x-app-route') === 'true';

  if (isMain) {
    const locale = 'de/en';

    return {
      // Return a locale to `next-intl` in case we've read
      // it from user settings instead of the pathname
      locale,
      ...(await getConfig(locale))
    };
  } else {
    // Be careful to only read from params if the route is public
    const locale = params.locale;
    return getConfig(locale);
  }
});