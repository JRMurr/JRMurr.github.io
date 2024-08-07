// const { withContentlayer } = require('next-contentlayer')

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

// // You might need to insert additional domains in script-src if you are using external services
// const ContentSecurityPolicy = `
//     default-src 'self';
//     script-src 'self' 'unsafe-eval' 'unsafe-inline' giscus.app analytics.umami.is;
//     style-src 'self' 'unsafe-inline';
//     img-src * blob: data:;
//     media-src *.s3.amazonaws.com;
//     connect-src *;
//     font-src 'self';
//     frame-src giscus.app https://lichess.org/;
//   `

const securityHeaders = [
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
  //   {
  //     key: 'Content-Security-Policy',
  //     value: ContentSecurityPolicy.replace(/\n/g, ''),
  //   },
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy
  //   {
  //     key: 'Referrer-Policy',
  //     value: 'strict-origin-when-cross-origin',
  //   },
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options
  //   {
  //     key: 'X-Frame-Options',
  //     value: 'DENY',
  //   },
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options
  //   {
  //     key: 'X-Content-Type-Options',
  //     value: 'nosniff',
  //   },
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-DNS-Prefetch-Control
  //   {
  //     key: 'X-DNS-Prefetch-Control',
  //     value: 'on',
  //   },
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security
  //   {
  //     key: 'Strict-Transport-Security',
  //     value: 'max-age=31536000; includeSubDomains',
  //   },
  //   // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Feature-Policy
  //   {
  //     key: 'Permissions-Policy',
  //     value: 'camera=(), microphone=(), geolocation=()',
  //   },
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'require-corp',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
]

/**
 * @type {import('next/dist/next-server/server/config').NextConfig}
 **/
module.exports = () => {
  const plugins = [
    // withContentlayer,
    withBundleAnalyzer,
  ]
  return plugins.reduce((acc, next) => next(acc), {
    output: 'export',
    // swcMinify: false,
    reactStrictMode: true,
    pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],
    eslint: {
      dirs: ['app', 'components', 'layouts', 'scripts'],
    },
    images: {
      unoptimized: true,
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'picsum.photos',
        },
      ],
    },
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: securityHeaders,
        },
      ]
    },
    webpack: (config, options) => {
      // config.optimization.minimize = false
      // config.optimization.minimizer = []

      // config.experiments = config.experiments ?? {}
      // config.experiments.asyncWebAssembly = true
      // config.experiments.layers = true

      // config.devtool = false
      // TODO: remove, nextjs trys to overwrite me...
      // Object.defineProperty(config, 'devtool', {
      //   get() {
      //     return false
      //   },
      //   set() {},
      // })

      config.module.rules.push({
        test: /\.svg$/,
        use: ['@svgr/webpack'],
      })

      if (process.env.IN_NIX) {
        console.log('skipping velite for nix')
      } else {
        config.plugins.push(new VeliteWebpackPlugin())
      }

      return config
    },
  })
}

class VeliteWebpackPlugin {
  static started = false
  apply(/** @type {import('webpack').Compiler} */ compiler) {
    // executed three times in nextjs
    // twice for the server (nodejs / edge runtime) and once for the client
    compiler.hooks.beforeCompile.tapPromise('VeliteWebpackPlugin', async () => {
      if (VeliteWebpackPlugin.started) return
      VeliteWebpackPlugin.started = true
      const dev = compiler.options.mode === 'development'
      const { build } = await import('velite')
      await build({ watch: dev, clean: !dev })
    })
  }
}
