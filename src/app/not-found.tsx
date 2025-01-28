import { cn } from "~/lib/utils";
import { GeistSans } from "geist/font/sans";

export default function NotFound() {
  return (
    <html className="h-full" lang="en">
      <body className={cn(GeistSans.className, 'flex h-full flex-col items-center justify-center bg-drossgray')}>
        <p>404 Not Found</p>
      </body>
    </html>
  );
}