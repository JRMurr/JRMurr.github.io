import { getAllPostSummaries } from '$lib/utils/posts';

const MAX_DISPLAY = 5;

export function load() {
	const allPosts = getAllPostSummaries();
	const posts = allPosts.slice(0, MAX_DISPLAY);
	return { posts, totalPosts: allPosts.length };
}
