export function ExternalLink({ children, href, hrefTitle, className }: { children: React.ReactNode; href: string; hrefTitle: string; className?: string }) {
    return <a
        href={href}
        title={hrefTitle}
        aria-label={hrefTitle}
        target="_blank"
        rel="noopener, noreferrer, noindex, nofollow"
        className={className}
    >
        {children}
    </a>;
}