export const PUBLIC_ORIGIN = 'https://delavnica.kocmut.com/';
export function structuredData(page) {
    return { '@context': 'https://schema.org', '@type': 'WebApplication',
        name: page.id === 'overview' ? 'Delavnica' : page.title,
        url: PUBLIC_ORIGIN + page.path, description: page.description,
        applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
        browserRequirements: 'Modern browser with JavaScript; Web Crypto for JWT signature verification',
        inLanguage: 'sl', isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } };
}
