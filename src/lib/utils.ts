import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const orgUrl = new URL('https://aip.aero/');
export const orgLogoUrl = new URL('/aip-logo-446x319.jpg', orgUrl);
export const orgLogoSquareUrl = new URL('/aip-logo-450x450.jpg', orgUrl);