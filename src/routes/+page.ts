import { getAllPostSummaries } from '$lib/utils/posts';

const MAX_DISPLAY = 5;

export function load() {
	const posts = getAllPostSummaries().slice(0, MAX_DISPLAY);
	return { posts };
}
