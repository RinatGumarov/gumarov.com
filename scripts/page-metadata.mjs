export const siteUrl = 'https://gumarov.com';
export const themeColor = '#080b0f';
export const socialCardWidth = 1200;
export const socialCardHeight = 630;

/**
 * Builds the complete localized head metadata for one prerendered route. The
 * copy comes from the typed content model so the prerender, the distribution
 * checks, and the tests share one source of truth.
 */
export function renderPageMetadata({ canonical, content }) {
  const meta = content.meta;
  const socialImageUrl = `${siteUrl}${meta.ogImage}`;

  return [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtmlAttribute(meta.description)}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<link rel="alternate" hreflang="en" href="${siteUrl}/en/" />`,
    `<link rel="alternate" hreflang="ru" href="${siteUrl}/ru/" />`,
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/" />`,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    '<link rel="apple-touch-icon" href="/icon-192.png" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    `<meta name="theme-color" content="${themeColor}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${escapeHtmlAttribute(meta.siteName)}" />`,
    `<meta property="og:locale" content="${meta.ogLocale}" />`,
    `<meta property="og:locale:alternate" content="${meta.ogAlternateLocale}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtmlAttribute(meta.description)}" />`,
    `<meta property="og:image" content="${socialImageUrl}" />`,
    '<meta property="og:image:type" content="image/jpeg" />',
    `<meta property="og:image:width" content="${socialCardWidth}" />`,
    `<meta property="og:image:height" content="${socialCardHeight}" />`,
    `<meta property="og:image:alt" content="${escapeHtmlAttribute(meta.ogImageAlt)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtmlAttribute(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtmlAttribute(meta.description)}" />`,
    `<meta name="twitter:image" content="${socialImageUrl}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtmlAttribute(meta.ogImageAlt)}" />`,
    renderPersonStructuredData({ canonical, content }),
  ];
}

export function renderPersonStructuredData({ canonical, content }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: content.meta.socialCard.name,
    jobTitle: content.meta.socialCard.role,
    url: canonical,
    image: `${siteUrl}${content.meta.ogImage}`,
    sameAs: [content.contact.telegramHref],
  };

  return `<script type="application/ld+json">${escapeJsonForScript(
    JSON.stringify(structuredData),
  )}</script>`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeHtmlAttribute(value) {
  return escapeHtml(value).replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function escapeJsonForScript(json) {
  return json
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}
