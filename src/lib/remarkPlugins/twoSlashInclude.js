import flatMap from 'unist-util-flatmap';

// A set of includes which can be pulled via a set ID
const includes = new Map();

const parsingNewFile = () => includes.clear();

const exportRe = /export=([^ ]*)/;

const replaceIncludesInCode = (_map, code) => {
	const includesRe = /\/\/ @include: (.*)$/gm;

	const toReplace = [];

	let match;
	while ((match = includesRe.exec(code)) !== null) {
		if (match.index === includesRe.lastIndex) {
			includesRe.lastIndex++;
		}
		const key = match[1];
		const replaceWith = _map.get(key);

		if (!replaceWith) {
			const msg = `Could not find an include with the key: '${key}'.\nThere is: ${Array.from(_map.keys())}.`;
			throw new Error(msg);
		}

		toReplace.push([match.index, match[0].length, replaceWith]);
	}

	let newCode = code.toString();
	toReplace.reverse().forEach((r) => {
		newCode = newCode.substring(0, r[0]) + r[2] + newCode.substring(r[0] + r[1]);
	});
	return newCode;
};

export function twoSlashInclude() {
	return (tree) => {
		parsingNewFile();
		flatMap(tree, (node) => {
			if (node.lang !== 'twoslash') {
				const meta = node.meta || '';
				if (node.lang === 'ts' && meta.includes('twoslash')) {
					node.value = replaceIncludesInCode(includes, node.value);
				}
				return [node];
			}
			node.lang = 'ts';
			const meta = node.meta || '';
			const exportMatch = meta.match(exportRe);
			if (exportMatch) {
				const exportName = exportMatch[1];
				includes.set(exportName, node.value);
			}
			return [];
		});
	};
}
