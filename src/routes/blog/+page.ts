import { getAllPostSummaries, getTagCounts } from '$lib/utils/posts';
import siteMetadata from '$lib/config/siteMetadata';

export function load() {
	const posts = getAllPostSummaries();
	const tagCounts = getTagCounts();
	const totalPages = Math.ceil(posts.length / siteMetadata.posts_per_page);
	const displayPosts = posts.slice(0, siteMetadata.posts_per_page);

	return {
		posts: displayPosts,
		tagCounts,
		totalPages,
		currentPage: 1,
	};
}
