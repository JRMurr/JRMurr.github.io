export const onRequestGet: PagesFunction = async () => {
	const resp = await fetch('https://plausible.io/js/script.js');
	const body = await resp.text();

	return new Response(body, {
		headers: {
			'Content-Type': 'application/javascript',
			'Cache-Control': 'public, max-age=86400',
		},
	});
};
