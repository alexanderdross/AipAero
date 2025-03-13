'use client';

import { useSearchParams } from 'next/navigation';
import { ReactNode, useTransition } from 'react';
import { Locale, usePathname, useRouter } from '~/i18n/routing';
import { Select, SelectContent, SelectTrigger, SelectValue } from '~/components/ui/select';

type Props = {
  children: ReactNode;
  defaultValue: string;
  label: string;
};

export default function LocaleSwitcherSelect({
  children,
  defaultValue,
  label
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = Object.fromEntries(useSearchParams().entries());

  function onSelectChange(value: string) {
    const nextLocale = value as Locale;
    startTransition(() => {
      router.replace(
        { pathname: pathname, query: searchParams },
        { locale: nextLocale }
      );
    });
  }

  return (
    <Select
      defaultValue={defaultValue}
      disabled={isPending}
      onValueChange={onSelectChange}
    >
      <SelectTrigger className="w-32" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {children}
      </SelectContent>
    </Select>
  );
}