import { error } from '@sveltejs/kit';
import {
	getAllPosts,
	getPostBySlug,
	getSeriesInfo,
	getPrevNext,
	getAuthorDetails,
} from '$lib/utils/posts';

export function load({ params }: { params: { slug: string } }) {
	const slug = params.slug;
	const post = getPostBySlug(slug);

	if (!post) {
		throw error(404, 'Post not found');
	}

	const seriesInfo = getSeriesInfo(slug);
	const { prev, next } = getPrevNext(slug);
	const authorDetails = getAuthorDetails(post.metadata.authors);

	return {
		post,
		seriesInfo,
		prev,
		next,
		authorDetails,
	};
}

export function entries() {
	return getAllPosts().map((p) => ({ slug: p.metadata.slug }));
}
