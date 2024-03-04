import { defineConfig, defineCollection, MdxOptions, s, z } from 'velite'
// import {
//   // remarkExtractFrontmatter,
//   remarkCodeTitles,
//   // remarkImgToJsx,
//   // extractTocHeadings,
// } from 'pliny/mdx-plugins'
import remarkMath from 'remark-math'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeKatex from 'rehype-katex'
// import rehypeCitation from 'rehype-citation'
import rehypePrismPlus from 'rehype-prism-plus'
import rehypePresetMinify from 'rehype-preset-minify'

import { writeFileSync } from 'fs'

import siteMetadata from './content/siteMetadata'
// import { allCoreContent, sortPosts } from './utils/velite'
import { Parent, visit } from 'unist-util-visit/lib'

// import remarkShikiTwoslash from 'remark-shiki-twoslash'
import rehypeShiki from '@shikijs/rehype'
import rehypeRaw from 'rehype-raw'
import { nodeTypes } from '@mdx-js/mdx'
import { transformerTwoslash } from '@shikijs/twoslash'
import { remarkCodeTitles } from 'remarkPlugins/remarkCodeTitles'
import { twoSlashInclude } from 'remarkPlugins/twoSlashInclude'
import { allCoreContent, sortPosts } from './utils/velite'

// https://github.com/zce/velite/tree/main/examples/nextjs

// const getComputedFields = (doc: {}) => {
//   return {
//     toc: '',
//   }
// }

const addDepthToNestedList = <T extends { items: T[] }>(item: T): T & { depth: number } => {
  const helper = ({ items, ...rest }: T, depth: number) => {
    const children = items.map((c) => helper(c, depth + 1))
    return { ...rest, depth, items: children }
  }

  return helper(item, 0)
}

export const blogs = defineCollection({
  name: 'Blog',
  pattern: 'blog/**/*.md', // @MIGRATE TODO: mdx too?\
  schema: s
    .object({
      title: s.string().max(99), // Zod primitive type
      date: s.isodate(), // input Date-like string, output ISO Date string.
      slug: s.slug('blog'), // validate format, unique in blog collection
      summary: s.string(),
      tags: s.array(s.string()).default([]),
      authors: s.array(s.string()).default(['default']),
      layout: s.string().default('PostLayout'),
      //   cover: s.image().optional(), // input image relpath, output image object with blurImage.
      //   video: s.file().optional(), // input file relpath, output file public path.
      metadata: s.metadata(), // extract markdown reading-time, word-count, etc.
      // excerpt: s.excerpt(), // excerpt of markdown content
      body: s.mdx(), // transform markdown to html
      tocRaw: s.toc(),
      draft: s.boolean().default(false),
      lastmod: s.isodate().optional(),
      path: s.path(),
    })
    // more additional fields (computed fields)
    .transform(({ tocRaw, ...data }) => {
      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: data.title,
        datePublished: data.date,
        dateModified: data.lastmod || data.date,
        description: data.summary,
        // image: data.images ? data.images[0] : siteMetadata.socialBanner,
        // url: `${siteMetadata.siteUrl}/${doc._raw.flattenedPath}`,
        url: '@MIGRATE TODO:',
      }
      // const computedFields = getComputedFields(data)
      return {
        ...data,
        toc: tocRaw.map(addDepthToNestedList),
        // computedFields,
        structuredData,
        permalink: `/blog/${data.slug}`,
        // path: '@MIGRATE TODO:',
      }
    }),
})

const authors = defineCollection({
  name: 'Author',
  pattern: 'authors/**/*.md', // @MIGRATE TODO: mdx too?\
  schema: s.object({
    slug: s.slug('author'),
    name: s.string(),
    avatar: s.image(),
    github: s.string(),
    twitter: s.string(),
    email: s.string(),
    mastodon: s.string(),
    body: s.mdx(),
  }),
})

type Blogs = z.infer<typeof blogs.schema>[]

function createSearchIndex(blogs: Blogs) {
  if (
    siteMetadata?.search?.provider === 'kbar' &&
    siteMetadata.search.kbarConfig.searchDocumentsPath
  ) {
    writeFileSync(
      `public/${siteMetadata.search.kbarConfig.searchDocumentsPath}`,
      JSON.stringify(allCoreContent(sortPosts(blogs)))
    )
    console.log('Local search index generated...')
  }
}

const twoSlashErrHandler = (err, code, lang, options) => {
  console.log('err, lang, options')
  // console.log(err, lang, options)
  throw err
}

const shikiErrorHandler = (err, code, lang) => {
  console.log('err, code, lang')
  console.log(err, code, lang)
  throw err
}

const markdownOptions: MdxOptions = {
  format: 'mdx',
  gfm: true,
  remarkPlugins: [
    twoSlashInclude,
    remarkCodeTitles, // @MIGRATE TODO: not working or syntax changed?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    remarkMath as any,
    // remarkImgToJsx // @MIGRATE TODO: do i need this?
  ],
  rehypePlugins: [
    // [rehypeRaw, { passThrough: nodeTypes }],
    [
      rehypeShiki,
      {
        theme: 'dracula',
        onError: (err) => {
          console.log('err', err)
        },
        transformers: [
          transformerTwoslash({
            explicitTrigger: true,
            onTwoslashError: twoSlashErrHandler,
            // onShikiError: shikiErrorHandler,
          }),
        ],
      },
    ],
    rehypeSlug,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rehypeAutolinkHeadings as any,
    rehypeKatex,
    // [rehypeCitation, { path: path.join(root, 'data') }],
    // [rehypePrismPlus as any, { defaultLanguage: 'js', ignoreMissing: true }],
    rehypePresetMinify, // @MIGRATE TODO: dyanmic imports?
  ],
}

const config = defineConfig({
  collections: {
    blogs,
    authors,
    // others: {
    //   // other collection schema options
    // },
  },
  // markdown: markdownOptions,
  mdx: markdownOptions,
  output: {
    assets: 'public/gen/',
    base: '/gen/',
    clean: true,
  },
  complete: (collections) => {
    createSearchIndex(collections.blogs)
  },
})

export default config
