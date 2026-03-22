import { getAllPosts } from '$lib/utils/posts';
import { escape } from '$lib/utils/htmlEscaper';
import siteMetadata from '$lib/config/siteMetadata';

export const prerender = true;

function generateRssItem(post: { metadata: { slug: string; title: string; summary: string; date: string; tags: string[] } }) {
	const { slug, title, summary, date, tags } = post.metadata;
	return `
  <item>
    <guid>${siteMetadata.siteUrl}/blog/${slug}</guid>
    <title>${escape(title)}</title>
    <link>${siteMetadata.siteUrl}/blog/${slug}</link>
    ${summary ? `<description>${escape(summary)}</description>` : ''}
    <pubDate>${new Date(date).toUTCString()}</pubDate>
    <author>${siteMetadata.email} (${siteMetadata.author})</author>
    ${tags.map((t) => `<category>${t}</category>`).join('')}
  </item>`;
}

export function GET() {
	const posts = getAllPosts();

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(siteMetadata.title)}</title>
    <link>${siteMetadata.siteUrl}/blog</link>
    <description>${escape(siteMetadata.description)}</description>
    <language>${siteMetadata.language}</language>
    <managingEditor>${siteMetadata.email} (${siteMetadata.author})</managingEditor>
    <webMaster>${siteMetadata.email} (${siteMetadata.author})</webMaster>
    <lastBuildDate>${new Date(posts[0]?.metadata.date ?? Date.now()).toUTCString()}</lastBuildDate>
    <atom:link href="${siteMetadata.siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${posts.map(generateRssItem).join('')}
  </channel>
</rss>`;

	return new Response(xml.trim(), {
		headers: { 'Content-Type': 'application/xml' },
	});
}
