'use client';

import { ChevronRightIcon, HomeIcon } from "@heroicons/react/solid";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = pathname.split('/').filter(Boolean);
  const breadcrumbsOfIndex = (index: number) => `/${breadcrumbs.slice(0, index + 1).join('/')}/`;

  return (
    <div className="max-w-7xl mx-auto pt-12 px-4 overflow-hidden sm:px-6 lg:px-8">
      <nav className="flex justify-center">
        <ol role="list" className="flex items-center space-x-4">
          <li>
            <div>
              <Link
                href="/"
                title="AIP Home"
                className="text-gray-400 hover:text-gray-500"
              >
                <HomeIcon className="flex-shrink-0 h-5 w-5" aria-hidden="true" />
                <span className="sr-only">AIP Home</span>
              </Link>
            </div>
          </li>
          {breadcrumbs?.map((breadcrumb, index) => (
            <li key={breadcrumb}>
              <div className="flex items-center">
                <ChevronRightIcon className="flex-shrink-0 h-5 w-5 text-gray-400" aria-hidden="true" />
                <Link
                  href={breadcrumbsOfIndex(index)}
                  title={breadcrumb.toLocaleUpperCase()}
                  className="ml-4 text-sm font-medium text-gray-500 hover:text-gray-700"
                  aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                >
                  {breadcrumb.toLocaleUpperCase()}
                </Link>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}