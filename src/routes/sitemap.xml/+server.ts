import { getAllPosts, getTagCounts } from '$lib/utils/posts';
import siteMetadata from '$lib/config/siteMetadata';

export const prerender = true;

export function GET() {
	const posts = getAllPosts();
	const tags = Object.keys(getTagCounts());

	const staticRoutes = ['', '/blog', '/tags', '/projects', '/about'];

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticRoutes
		.map(
			(route) => `
  <url>
    <loc>${siteMetadata.siteUrl}${route}</loc>
  </url>`
		)
		.join('')}
  ${posts
		.map(
			(post) => `
  <url>
    <loc>${siteMetadata.siteUrl}/blog/${post.metadata.slug}</loc>
    <lastmod>${new Date(post.metadata.lastmod || post.metadata.date).toISOString()}</lastmod>
  </url>`
		)
		.join('')}
  ${tags
		.map(
			(tag) => `
  <url>
    <loc>${siteMetadata.siteUrl}/tags/${tag}</loc>
  </url>`
		)
		.join('')}
</urlset>`;

	return new Response(xml.trim(), {
		headers: { 'Content-Type': 'application/xml' },
	});
}
