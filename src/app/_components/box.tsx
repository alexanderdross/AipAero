import Link from "next/link";
import { ExternalLinkIcon } from '@heroicons/react/solid';

export function Box({
  title,
  description,
  flag,
  buttons,
}: {
  title: string;
  description: string;
  flag?: string;
  buttons?: { href: string; hrefTitle: string, title?: string }[];
}) {
  return (
    <li className="col-span-1 bg-white rounded-lg shadow divide-y divide-gray-200">
    <div className="w-full flex items-center justify-between p-6 space-x-6">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <h2 className="text-gray-900 text-sm font-medium truncate">{title}</h2>
          <span className="flex-shrink-0 inline-block px-2 py-0.5 text-green-800 text-xs font-medium bg-green-100 rounded-full">
            New
          </span>
        </div>
        <p className="mt-1 text-gray-500 text-sm">{description}</p>
      </div>
      {flag && (<div className="w-10 h-10 bg-white rounded-full flex-shrink-0 flex items-center justify-center text-4xl">
        {flag}
      </div>)}
    </div>
    <div>
      <div className="-mt-px flex divide-x divide-gray-200">
      {buttons?.map((b) => (
        <div key={b.hrefTitle} className="w-0 flex-1 flex px-3">
          <Link
            href={b.href}
            title={b.hrefTitle}
            className="relative -mr-px w-0 flex-1 inline-flex items-center justify-center py-4 text-sm text-gray-700 font-medium border border-transparent rounded-bl-lg hover:text-gray-500"
            target="_self"
            rel="noopener"
          >
            <ExternalLinkIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
            <span className="ml-3">{b.title ?? b.hrefTitle}</span>
          </Link>
        </div>
      ))}
      </div>
    </div>
    </li>
  );
}
