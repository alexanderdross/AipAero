import { useLocale, useTranslations } from 'next-intl';
import LocaleSwitcherSelect from '~/components/locale-switcher-select';
import { SelectItem } from "~/components/ui/select";
import { SchemaWebpage } from './schemas/schema-webpage';

export default function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const locale = useLocale();

  const nonEnglish = locale.replace('-EN', '');
  const english = nonEnglish + '-EN';

  if (locale === 'uk' || locale === 'us') {
    return;
  }

  return (
    <>
      <SchemaWebpage 
        nonEnglishLocale={nonEnglish} 
        englishLocale={english}
      />
      <LocaleSwitcherSelect defaultValue={locale} label={t('label')}>
        <SelectItem value={nonEnglish}>
          {t('locale', { locale: nonEnglish })}
        </SelectItem>
        <SelectItem value={english}>
          {t('locale', { locale: 'en' })}
        </SelectItem>
      </LocaleSwitcherSelect>
    </>
  );
}