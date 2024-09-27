export const orgUrl = new URL('https://aip.aero/');
export const orgLogoUrl = new URL('/favicon/Suchmaske-Luftfahrthandbuch-AIP-Aeronautical-Information-Publication-VFR-IFR-Heliports-446x319.jpg', orgUrl);
export const orgLogoSquareUrl = new URL('/favicon/Suchmaske-Luftfahrthandbuch-AIP-Aeronautical-Information-Publication-VFR-IFR-Heliports-450x450.jpg', orgUrl);

interface Props {
  title: string;
  description: string;
  url: string;
  canonical?: string;
  alternates?: { href: string; hrefLang: string }[];
}

export default function Metadata({
  title,
  description,
  url,
  canonical,
  alternates,
}: Props) {
  alternates = alternates ? [...(new Set(alternates.map(e => JSON.stringify(e))))].map(e => JSON.parse(e)) : [];
  return (
    <>
      <title>{`🛩️ ${title}`}</title>
      <meta name="description" content={`${description} 🗺️`} />
      <meta name="abstract" content={`${description} 🗺️`} />
      <meta name="author" content="Alexander Dross" />
      <meta name="publisher" content="Alexander Dross" />
      <meta name="robots" content="index,follow,noodp,noydir" />
      <link rel="canonical" href={new URL(canonical ?? url, orgUrl).toString()} />
      <link rel="alternate" hrefLang="x-default" href={orgUrl.toString()} />
      {alternates?.map(({ href, hrefLang }) => (
        <link key={hrefLang} rel="alternate" hrefLang={hrefLang} href={href} />
      ))}
      <meta property="fb:admins" content="1378231674" />
      <meta property="og:title" content={`🛩️ ${title}`} />
      <meta property="og:description" content={`${description} 🗺️`} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={`🛩️ ${title}`} />
      <meta property="og:image" content={orgLogoUrl.toString()} />
      <meta property="og:image:width" content="446" />
      <meta property="og:image:height" content="319" />
      <meta property="og:image:alt" content="Logo" />
      <meta property="og:image:type" content="image/jpg" />
      <meta property="og:image" content={orgLogoSquareUrl.toString()} />
      <meta property="og:image:width" content="450" />
      <meta property="og:image:height" content="450" />
      <meta property="og:image:alt" content="Logo Quadratisch" />
      <meta property="og:image:type" content="image/jpg" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@alexanderdross" />
      <meta name="twitter:title" content={`🛩️ ${title}`} />
      <meta name="twitter:description" content={`${description} 🗺️`} />
      <meta name="twitter:image" content={orgLogoUrl.toString()} />
      <meta name="twitter:image:width" content="446" />
      <meta name="twitter:image:height" content="319" />
      <meta name="twitter:image:alt" content="Logo" />
      <meta name="twitter:image:type" content="image/jpg" />
      <meta name="twitter:image" content={orgLogoSquareUrl.toString()} />
      <meta name="twitter:image:width" content="450" />
      <meta name="twitter:image:height" content="450" />
      <meta name="twitter:image:alt" content="Logo Quadratisch" />
      <meta name="twitter:image:type" content="image/jpg" />
      <link rel="icon" href="/favicon/android-icon-192x192.png" sizes="192x192" type="image/png" />
      <link rel="icon" href="/favicon/favicon-32x32.png" sizes="32x32" type="image/png" />
      <link rel="icon" href="/favicon/favicon-96x96.png" sizes="96x96" type="image/png" />
      <link rel="icon" href="/favicon/favicon-16x16.png" sizes="16x16" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-57x57.png" sizes="57x57" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-60x60.png" sizes="60x60" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-72x72.png" sizes="72x72" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-76x76.png" sizes="76x76" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-114x114.png" sizes="114x114" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-120x120.png" sizes="120x120" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-144x144.png" sizes="144x144" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-152x152.png" sizes="152x152" type="image/png" />
      <link rel="apple-touch-icon" href="/favicon/apple-icon-180x180.png" sizes="180x180" type="image/png" />
    </>
  );
}

