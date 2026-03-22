import siteMetadata from '$lib/config/siteMetadata';

export const prerender = true;

export function GET() {
	const body = `User-agent: *
Allow: /

Sitemap: ${siteMetadata.siteUrl}/sitemap.xml
`;

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain' },
	});
}
