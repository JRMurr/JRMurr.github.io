const siteMetadata = {
	title: "John's Codes",
	author: 'John Murray',
	headerTitle: "John's Codes",
	description: 'My ramblings on programming',
	language: 'en-us',
	theme: 'system', // system, dark or light
	siteUrl: 'https://johns.codes',
	siteRepo: 'https://github.com/JRMurr/JRMurr.github.io',
	siteLogo: '/images/logo.png',
	mastodon: 'https://hachyderm.io/@jrmurr',
	bsky: 'https://bsky.app/profile/johns.codes',
	email: 'johnreillymurray@gmail.com',
	github: 'https://github.com/JRMurr',
	twitter: 'https://twitter.com/JRMurrCodes',
	locale: 'en-US',
	analytics: {
		plausibleAnalytics: {
			plausibleDataDomain: 'johns.codes',
		},
	},
	comments: {
		provider: 'giscus' as const,
		giscusConfig: {
			repo: 'JRMurr/JRMurr.github.io' as const,
			repositoryId: 'R_kgDOGuvrNw',
			category: 'Comments',
			categoryId: 'DIC_kwDOGuvrN84CPZ0a',
			mapping: 'pathname' as const,
			reactions: '1',
			metadata: '0',
			theme: 'preferred_color_scheme',
			darkTheme: 'transparent_dark',
			themeURL: '',
			lang: 'en',
		},
	},
	posts_per_page: 15,
} as const;

export default siteMetadata;
