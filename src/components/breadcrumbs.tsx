'use client'

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { usePathname, Link as IntLink } from "~/i18n/routing";

export function BreadCrumbs() {
  const t = useTranslations('BreadCrumbs');
  const pathname = usePathname();
  const icao = useSearchParams().keys().next().value;

  return (
    <div className="w-max mx-auto py-8 px-4 overflow-hidden sm:px-6 lg:px-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                href="/"
                title={t('root.hrefTitle')}
              >{t('root.title')}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {pathname === '/' ? (
            <BreadcrumbItem>
              <BreadcrumbPage>{t("/.title")}</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (<>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <IntLink
                  href="/"
                  title={t("/.hrefTitle")}
                >{t("/.title")}
                </IntLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>)}

          {pathname !== '/' && icao && (
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <IntLink
                  href={pathname}
                  title={t(`${pathname}.hrefTitle`)}
                >{t(`${pathname}.title`)}
                </IntLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}

          {pathname !== '/' && !icao && (
            <BreadcrumbItem>
              <BreadcrumbPage>{t(`${pathname}.title`)}</BreadcrumbPage>
            </BreadcrumbItem>
          )}

          {/* Render the param breadcrumb item */}
          {icao && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{icao.split('-').map(x => String(x).charAt(0).toUpperCase() + String(x).slice(1)).join(' ')}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}