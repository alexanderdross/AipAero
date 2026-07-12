"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { usePathname, Link as IntLink } from "~/i18n/routing";

export function BreadCrumbs() {
  const t = useTranslations("BreadCrumbs");
  const pathname = usePathname();
  const icao = useSearchParams().keys().next().value;

  return (
    // Long trails (airport titles) must not wrap to a second line - that
    // would exceed the layout's reserved bar height (min-h-[5.5rem]) and
    // shift the footer. Instead the bar scrolls horizontally on overflow,
    // same pattern as the mobile pill nav: scrollbar hidden, the clipped
    // last crumb is the affordance. mx-auto + w-max centers short trails
    // (justify-center on the scroll container would make the left edge
    // unreachable when overflowing).
    <div className="[scrollbar-width:none] overflow-x-auto px-4 py-8 sm:px-6 lg:px-8 [&::-webkit-scrollbar]:hidden">
      <Breadcrumb className="mx-auto w-max">
        <BreadcrumbList className="flex-nowrap whitespace-nowrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/" title={t("root.hrefTitle")}>
                {t("root.title")}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          {pathname === "/" ? (
            <BreadcrumbItem>
              <BreadcrumbPage>{t("/.title")}</BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            <>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <IntLink href="/" title={t("/.hrefTitle")}>
                    {t("/.title")}
                  </IntLink>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </>
          )}

          {pathname !== "/" && icao && (
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <IntLink href={pathname} title={t(`${pathname}.hrefTitle`)}>
                  {t(`${pathname}.title`)}
                </IntLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
          )}

          {pathname !== "/" && !icao && (
            <BreadcrumbItem>
              <BreadcrumbPage>{t(`${pathname}.title`)}</BreadcrumbPage>
            </BreadcrumbItem>
          )}

          {/* Render the param breadcrumb item */}
          {icao && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {icao
                    .split("-")
                    .map(
                      (x) =>
                        String(x).charAt(0).toUpperCase() + String(x).slice(1),
                    )
                    .join(" ")}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
