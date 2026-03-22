import { visit } from 'unist-util-visit';

export function remarkCodeTitles() {
	return (tree) =>
		visit(tree, 'code', (node, index, parent) => {
			if (index === undefined || !parent) return;

			const nodeLang = node.lang || '';
			let language = '';
			let title = '';

			if (nodeLang.includes(':')) {
				language = nodeLang.slice(0, nodeLang.search(':'));
				title = nodeLang.slice(nodeLang.search(':') + 1, nodeLang.length);
			}

			if (!title) {
				return;
			}

			// Emit raw HTML instead of mdxJsxFlowElement for mdsvex compatibility
			const titleNode = {
				type: 'html',
				value: `<div class="remark-code-title">${title}</div>`,
			};

			parent.children.splice(index, 0, titleNode);
			node.lang = language;
		});
}
