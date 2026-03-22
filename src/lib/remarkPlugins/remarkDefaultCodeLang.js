import { visit } from 'unist-util-visit';

export function remarkDefaultCodeLang() {
	return (tree) => {
		visit(tree, 'code', (node) => {
			if (!node.lang) {
				node.lang = 'text';
			}
		});
	};
}
