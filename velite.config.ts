import { defineConfig, defineCollection, s, z } from 'velite'
import {
  remarkExtractFrontmatter,
  remarkCodeTitles,
  remarkImgToJsx,
  extractTocHeadings,
} from 'pliny/mdx-plugins/index.js'
import { writeFileSync } from 'fs'

import siteMetadata from './content/siteMetadata'
import { allCoreContent, sortPosts } from './utils/velite'
// https://github.com/zce/velite/tree/main/examples/nextjs

// const getComputedFields = (doc: {}) => {
//   return {
//     toc: '',
//   }
// }

export const blogs = defineCollection({
  name: 'Blog',
  pattern: 'blog/**/*.mdx', // @MIGRATE TODO: md too?\
  schema: s
    .object({
      title: s.string().max(99), // Zod primitive type
      date: s.isodate(), // input Date-like string, output ISO Date string.
      slug: s.slug('blog'), // validate format, unique in posts collection
      summary: s.string(),
      tags: s.array(s.string()).default([]),
      authors: s.array(s.string()).default(['default']),
      layout: s.string().default('PostLayout'),
      //   cover: s.image().optional(), // input image relpath, output image object with blurImage.
      //   video: s.file().optional(), // input file relpath, output file public path.
      metadata: s.metadata(), // extract markdown reading-time, word-count, etc.
      excerpt: s.excerpt(), // excerpt of markdown content
      body: s.mdx(), // transform markdown to html
      toc: s.toc(),
      draft: s.boolean().default(false),
      lastmod: s.isodate().optional(),
      path: s.path(),
    })
    // more additional fields (computed fields)
    .transform((data) => {
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
        // computedFields,
        structuredData,
        permalink: `/blog/${data.slug}`,
        // path: '@MIGRATE TODO:',
      }
    }),
})

const authors = defineCollection({
  name: 'Author',
  pattern: 'authors/**/*.mdx',
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

const config = defineConfig({
  collections: {
    blogs,
    authors,
    // others: {
    //   // other collection schema options
    // },
  },
  complete: async ({ blogs }) => {
    createSearchIndex(blogs)
  },
})

export default config
