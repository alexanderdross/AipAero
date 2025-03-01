import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { routing } from "~/i18n/routing";
import { Airport } from "~/server/db/schema";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const orgUrl = new URL('https://aip.aero/');
export const orgLogoUrl = new URL('/aip-logo-446x319.jpg', orgUrl);
export const orgLogoSquareUrl = new URL('/aip-logo-450x450.jpg', orgUrl);
export const rootTitle = 'Free AIP and Approach Charts for VFR, IFR & Heliports';
export const rootDescription = 'Open Library for Aeronautical Information Publication (AIP) for VFR, IFR & Heliports.';
export const rootBreadcrumb = {
  "@type": "ListItem",
  "position": 1,
  "item": {
    "@id": orgUrl.toString(),
    "name": "AIP:Aero",
    "alternateName": rootTitle,
    "description": rootDescription
  }
};
export const i18nPathMapping: Record<Airport['type'], keyof typeof routing['pathnames']> = {
  'vfr': '/vfr',
  'ifr': '/ifr',
  'heliport': '/heliports',
}