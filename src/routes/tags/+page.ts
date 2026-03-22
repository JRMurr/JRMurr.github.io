import { getTagCounts } from '$lib/utils/posts';

export function load() {
	return { tagCounts: getTagCounts() };
}
