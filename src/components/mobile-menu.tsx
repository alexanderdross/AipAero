"use client";

import * as React from "react";
import { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { Link as IntLink } from "~/i18n/routing";

import { cn } from "~/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import { Button } from "~/components/ui/button";
import { useTranslations } from "next-intl";

export function MobileNav() {
  const t = useTranslations("Menu");
  const items = [
    { href: "/" as const, key: "home" },
    { href: "/vfr" as const, key: "vfr" },
    { href: "/ifr" as const, key: "ifr" },
    { href: "/heliports" as const, key: "heliports" },
    { href: "/airport-list" as const, key: "airports" },
  ];

  const [open, setOpen] = React.useState(false);

  const onOpenChange = React.useCallback(
    (open: boolean) => {
      setOpen(open);
      //setMetaColor(open ? "#09090b" : metaColor)
    },
    [open],
    //[setMetaColor, metaColor]
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          className="-ml-2 mr-2 h-8 w-8 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 lg:hidden"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            className="!size-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9h16.5m-16.5 6.75h16.5"
            />
          </svg>
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[60svh] p-0">
        <DrawerHeader className="hidden">
          <DrawerTitle />
          <DrawerDescription />
        </DrawerHeader>
        <div className="overflow-auto p-6">
          <div className="flex flex-col space-y-3">
            {items.map(
              (item) =>
                t.has(`${item.key}.title`) && (
                  <MobileLink
                    title={t(`${item.key}.hrefTitle`)}
                    key={item.href}
                    href={item.href}
                    onOpenChange={setOpen}
                  >
                    {t(`${item.key}.title`)}
                  </MobileLink>
                ),
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

interface MobileLinkProps extends LinkProps {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

function MobileLink({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: MobileLinkProps & React.ComponentProps<typeof IntLink>) {
  const router = useRouter();
  return (
    <IntLink
      href={href}
      onClick={() => {
        router.push(href.toString());
        onOpenChange?.(false);
      }}
      className={cn("text-base", className)}
      {...props}
    >
      {children}
    </IntLink>
  );
}
