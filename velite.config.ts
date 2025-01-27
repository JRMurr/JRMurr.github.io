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
import rehypePresetMinify from 'rehype-preset-minify'

import { writeFileSync } from 'fs'

import siteMetadata from './content/siteMetadata'
// import { allCoreContent, sortPosts } from './utils/velite'
// import { Parent, visit } from 'unist-util-visit/lib'

// import remarkShikiTwoslash from 'remark-shiki-twoslash'
import rehypeShiki, { RehypeShikiOptions } from '@shikijs/rehype'
// import rehypeRaw from 'rehype-raw'
// import { nodeTypes } from '@mdx-js/mdx'
import { transformerTwoslash } from '@shikijs/twoslash'
import { allCoreContent, sortPosts } from './utils/velite'
import { slug } from 'github-slugger'
import { remarkCodeTitles, remarkDefaultCodeLang, twoSlashInclude } from 'remarkPlugins'
import { generateRSS } from './scripts/rss'

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

const mySlug = (by: string = 'global', reserved: string[] = []) =>
  z
    .string()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:(-|\/)[a-z0-9]+)*$/i, 'Invalid slug')
    .refine((value) => !reserved.includes(value), 'Reserved slug')
    .superRefine((value, { path, meta, addIssue }) => {
      const key = `schemas:slug:${by}:${value}`
      const { cache } = meta.config
      if (cache.has(key)) {
        addIssue({
          fatal: true,
          code: 'custom',
          message: `duplicate slug '${value}' in '${meta.path}:${path.join('.')}'`,
        })
      } else {
        cache.set(key, meta.path)
      }
    })

export const blogs = defineCollection({
  name: 'Blog',
  pattern: 'blog/**/*.md',
  schema: s
    .object({
      title: s.string().max(99), // Zod primitive type
      seriesTitle: s.string().optional(),
      date: s.isodate(), // input Date-like string, output ISO Date string.
      slug: mySlug('blog'), // validate format, unique in blog collection
      summary: s.string(),
      tags: s.array(s.string()).default([]),
      authors: s.array(s.string()).default(['default']),
      layout: s.string().default('PostSimple'),
      //   cover: s.image().optional(), // input image relpath, output image object with blurImage.
      //   video: s.file().optional(), // input file relpath, output file public path.
      metadata: s.metadata(), // extract markdown reading-time, word-count, etc.
      // excerpt: s.excerpt(), // excerpt of markdown content
      body: s.mdx(), // transform markdown to html
      tocRaw: s.toc(),
      draft: s.boolean().default(false),
      lastmod: s.isodate().optional(),
      realPath: s.path(),
      // path: s.path(),
    })
    // more additional fields (computed fields)
    .transform(({ tocRaw, ...data }) => {
      // console.log(`path: ${data.path}\tslug:${slug(data.path)}`)

      const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: data.title,
        datePublished: data.date,
        dateModified: data.lastmod || data.date,
        description: data.summary,
        // image: data.images ? data.images[0] : siteMetadata.socialBanner,
        // url: `${siteMetadata.siteUrl}/${doc._raw.flattenedPath}`,
        // url: '',
      }
      // const computedFields = getComputedFields(data)
      // const slug = data.path.replace('blog/', '')

      // console.log({ path: data.path, slug })

      return {
        ...data,
        path: `blog/${data.slug}`,
        // slug,
        toc: tocRaw.map(addDepthToNestedList),
        // computedFields,
        structuredData,
        // permalink: `/blog/${data.slug}`,
      }
    }),
})

const seriesDescriptions = defineCollection({
  name: 'SeriesDescriptions',
  pattern: 'blog/**/**/info.yml',
  schema: s.object({
    title: s.string().max(99),
    slug: mySlug('series'),
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
    bsky: s.string(),
    body: s.mdx(),
  }),
})

export type Blogs = z.infer<typeof blogs.schema>[]

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

async function createRss(blogs: Blogs) {
  const tagCounts = createTagCount(blogs)

  await generateRSS(siteMetadata, blogs, tagCounts)
}

const isProduction = process.env.NODE_ENV === 'production'
function createTagCount(blogs) {
  const tagCount: Record<string, number> = {}
  blogs.forEach((file) => {
    if (file.tags && (!isProduction || file.draft !== true)) {
      file.tags.forEach((tag) => {
        const formattedTag = slug(tag)
        if (formattedTag in tagCount) {
          tagCount[formattedTag] += 1
        } else {
          tagCount[formattedTag] = 1
        }
      })
    }
  })
  writeFileSync('./app/tag-data.json', JSON.stringify(tagCount))

  return tagCount
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

const rekypeShikiOptions: RehypeShikiOptions = {
  themes: {
    light: 'github-light',
    // would like to use dracula but it adds too many italics,
    // not super easy to change that without forking or doing weird stuff
    dark: 'github-dark',
  },
  onError: (err) => {
    console.log('err', err)
  },
  transformers: [
    transformerTwoslash({
      explicitTrigger: true,
      onTwoslashError: twoSlashErrHandler,
      onShikiError: shikiErrorHandler,
    }),
  ],
}

const markdownOptions: MdxOptions = {
  format: 'mdx',
  gfm: true,
  removeComments: true,
  remarkPlugins: [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [remarkMath as any, { singleDollarTextMath: true }],
    remarkDefaultCodeLang,
    twoSlashInclude,
    remarkCodeTitles,
    // remarkImgToJsx // @MIGRATE TODO: do i need this?
  ],
  rehypePlugins: [
    // [rehypeRaw, { passThrough: nodeTypes }],
    [rehypeShiki, rekypeShikiOptions],
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
    seriesDescriptions,
  },
  // markdown: markdownOptions,
  mdx: markdownOptions,
  output: {
    assets: 'public/gen/',
    base: '/gen/',
    clean: true,
  },
  complete: async (collections) => {
    createSearchIndex(collections.blogs)
    await createRss(collections.blogs)
  },
})

export default config
