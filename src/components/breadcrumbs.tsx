'use client'

import { useTranslations } from "next-intl";
import Link from "next/link";
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
          {pathname !== undefined && pathname !== '/' && (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <IntLink
                    href={pathname}
                    title={t(`${pathname}.hrefTitle`)}
                  >{t(`${pathname}.title`)}
                  </IntLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}