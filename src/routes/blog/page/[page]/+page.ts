import { getAllPostSummaries, getTagCounts } from '$lib/utils/posts';
import siteMetadata from '$lib/config/siteMetadata';
import { error } from '@sveltejs/kit';

export function load({ params }) {
	const page = parseInt(params.page);
	if (isNaN(page) || page < 1) throw error(404, 'Invalid page number');

	const posts = getAllPostSummaries();
	const totalPages = Math.ceil(posts.length / siteMetadata.posts_per_page);

	if (page > totalPages) throw error(404, 'Page not found');

	const start = (page - 1) * siteMetadata.posts_per_page;
	const displayPosts = posts.slice(start, start + siteMetadata.posts_per_page);

	return {
		posts: displayPosts,
		tagCounts: getTagCounts(),
		totalPages,
		currentPage: page,
	};
}

export function entries() {
	const posts = getAllPostSummaries();
	const totalPages = Math.ceil(posts.length / siteMetadata.posts_per_page);
	return Array.from({ length: totalPages }, (_, i) => ({ page: String(i + 1) }));
}
