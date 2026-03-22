const htmlEscapes: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
};

const reUnescapedHtml = /[&<>"']/g;

export function escape(str: string): string {
	return str.replace(reUnescapedHtml, (chr) => htmlEscapes[chr]);
}
