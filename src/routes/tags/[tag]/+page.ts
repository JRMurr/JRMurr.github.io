import { getPostsByTag, getTagCounts } from '$lib/utils/posts';

export function load({ params }: { params: { tag: string } }) {
	const tag = params.tag;
	const posts = getPostsByTag(tag).map(({ component: _, ...rest }) => rest);
	const tagCounts = getTagCounts();

	return { tag, posts, tagCounts };
}

export function entries() {
	const tagCounts = getTagCounts();
	return Object.keys(tagCounts).map((tag) => ({ tag }));
}
