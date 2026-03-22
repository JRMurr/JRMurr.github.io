// mdsvex pre-parses the template before remark plugins run, so `<` inside
// `$...$` math expressions gets treated as HTML element syntax. This
// preprocessor escapes angle brackets before mdsvex sees them.
//
// We do NOT escape { and } because remark-math v3 (compatible with mdsvex)
// properly converts $..$ to math nodes before Svelte's compiler runs, so
// the { } characters inside math are safely inside KaTeX HTML output.

export function escapeMathPreprocessor() {
	return {
		markup({ content, filename }) {
			if (!filename?.endsWith('.md')) return;

			let output = content;
			let inCodeBlock = false;

			const lines = output.split('\n');
			const processedLines = lines.map((line) => {
				if (line.trimStart().startsWith('```')) {
					inCodeBlock = !inCodeBlock;
					return line;
				}
				if (inCodeBlock) return line;

				// Escape display math: $$...$$ (single line)
				line = line.replace(/\$\$(.*?)\$\$/g, (match, inner) => {
					const escaped = inner.replace(/</g, '&lt;').replace(/>/g, '&gt;');
					return '$$' + escaped + '$$';
				});

				// Escape inline math: $...$ that contains < or >
				line = line.replace(/(?<!\$)\$(?!\$)(.*?)\$(?!\$)/g, (match, inner) => {
					if (!inner.includes('<') && !inner.includes('>')) return match;
					const escaped = inner.replace(/</g, '&lt;').replace(/>/g, '&gt;');
					return '$' + escaped + '$';
				});

				return line;
			});

			output = processedLines.join('\n');

			return { code: output };
		},
	};
}
