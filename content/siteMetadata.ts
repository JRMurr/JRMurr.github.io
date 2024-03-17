const siteMetadata = {
  title: "John's Codes",
  author: 'John Murray',
  headerTitle: "John's Codes",
  description: 'My ramblings on programming',
  language: 'en-us',
  theme: 'system', // system, dark or light
  siteUrl: 'https://johns.codes',
  siteRepo: 'https://github.com/JRMurr/JRMurr.github.io',
  siteLogo: '/static/images/logo.png',
  socialBanner: '/static/images/twitter-card.png',
  mastodon: 'https://hachyderm.io/@jrmurr',
  email: '',
  github: 'https://github.com/JRMurr',
  twitter: 'https://twitter.com/JRMurrCodes',
  locale: 'en-US',
  analytics: {
    // @MIGRATE TODO: do this
    // If you want to use an analytics provider you have to add it to the
    // content security policy in the `next.config.js` file.

    // supports Plausible, Simple Analytics, Umami, Posthog or Google Analytics.
    // umamiAnalytics: {
    //   // We use an env variable for this site to avoid other users cloning our analytics ID
    //   umamiWebsiteId: process.env.NEXT_UMAMI_ID, // e.g. 123e4567-e89b-12d3-a456-426614174000
    //   // You may also need to overwrite the script if you're storing data in the US - ex:
    //   // src: 'https://us.umami.is/script.js'
    //   // Remember to add 'us.umami.is' in `next.config.js` as a permitted domain for the CSP
    // },
    plausibleAnalytics: {
      plausibleDataDomain: 'johns.codes', // e.g. tailwind-nextjs-starter-blog.vercel.app
    },
    // simpleAnalytics: {},
    // posthogAnalytics: {
    //   posthogProjectApiKey: '', // e.g. 123e4567-e89b-12d3-a456-426614174000
    // },
    // googleAnalytics: {
    //   googleAnalyticsId: '', // e.g. G-XXXXXXX
    // },
  },
  newsletter: {
    // supports mailchimp, buttondown, convertkit, klaviyo, revue, emailoctopus
    // Please add your .env file and modify it according to your selection
    provider: undefined, //'buttondown',
  },
  comments: {
    // If you want to use an analytics provider you have to add it to the
    // content security policy in the `next.config.js` file.
    // Select a provider and use the environment variables associated to it
    // https://vercel.com/docs/environment-variables
    provider: 'giscus', // supported providers: giscus, utterances, disqus
    giscusConfig: {
      // Visit the link below, and follow the steps in the 'configuration' section
      // https://giscus.app/
      repo: 'JRMurr/JRMurr.github.io',
      repositoryId: 'R_kgDOGuvrNw',
      category: 'Comments',
      categoryId: 'DIC_kwDOGuvrN84CPZ0a',
      mapping: 'pathname', // supported options: pathname, url, title
      reactions: '1', // Emoji reactions: 1 = enable / 0 = disable
      // Send discussion metadata periodically to the parent window: 1 = enable / 0 = disable
      metadata: '0',
      // theme example: light, dark, dark_dimmed, dark_high_contrast
      // transparent_dark, preferred_color_scheme, custom
      theme: 'preferred_color_scheme',
      // theme when dark mode
      darkTheme: 'transparent_dark',
      // If the theme option above is set to 'custom`
      // please provide a link below to your custom theme css file.
      // example: https://giscus.app/themes/custom_example.css
      themeURL: '',
      // This corresponds to the `data-lang="en"` in giscus's configurations
      lang: 'en',
    },
  },
  search: {
    provider: 'kbar', // kbar or algolia
    kbarConfig: {
      searchDocumentsPath: 'search.json', // path to load documents to search
    },
    // provider: 'algolia',
    // algoliaConfig: {
    //   // The application ID provided by Algolia
    //   appId: 'R2IYF7ETH7',
    //   // Public API key: it is safe to commit it
    //   apiKey: '599cec31baffa4868cae4e79f180729b',
    //   indexName: 'docsearch',
    // },
  },
} as const

export default siteMetadata
