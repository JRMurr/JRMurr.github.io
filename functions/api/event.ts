export const onRequestPost: PagesFunction = async ({ request }) => {
	const body = await request.text();

	return fetch('https://plausible.io/api/event', {
		method: 'POST',
		headers: {
			'User-Agent': request.headers.get('User-Agent') ?? '',
			'X-Forwarded-For': request.headers.get('CF-Connecting-IP') ?? '',
			'Content-Type': 'application/json',
		},
		body,
	});
};
