// import 'css/prism.css'
import '@/css/code-title.css'
import 'katex/dist/katex.css'
import '@shikijs/twoslash/style-rich.css'

import { components } from '@/components/mdxComponents'
import { sortPosts, coreContent, allCoreContent, findAuthor } from '@/utils/velite'
import { blogs, authors, seriesDescriptions } from '@/velite/generated'
import type { Blog } from '@/velite/generated'
import PostSimple from '@/layouts/PostSimple'
import PostLayout from '@/layouts/PostLayout'
import PostBanner from '@/layouts/PostBanner'
import { Metadata } from 'next'
import siteMetadata from '@/content/siteMetadata'
import { notFound } from 'next/navigation'
import { MDXContent } from '@/components/MDXContent'

const defaultLayout = 'PostLayout'
const layouts = {
  PostSimple,
  PostLayout,
  PostBanner,
}

export interface SeriesInfo {
  title: string
  posts: Array<Blog>
}

interface SeriesMatter {
  title: string
  tags?: string[]
  summary?: string
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string[] }
}): Promise<Metadata | undefined> {
  const slug = decodeURI(params.slug.join('/'))
  const post = blogs.find((p) => p.slug === slug)
  const authorList = post?.authors || ['default']
  const authorDetails = authorList.map((author) => {
    return coreContent(findAuthor(authors, author))
  })
  if (!post) {
    return
  }

  const publishedAt = new Date(post.date).toISOString()
  const modifiedAt = new Date(post.lastmod || post.date).toISOString()
  const authorsToshow = authorDetails.map((author) => author.name)
  const imageList: string[] = [] //[siteMetadata.socialBanner]
  // @MIGRATE TODO: images?
  // if (post.images) {
  //   imageList = typeof post.images === 'string' ? [post.images] : post.images
  // }
  const ogImages = imageList.map((img) => {
    return {
      url: img.includes('http') ? img : siteMetadata.siteUrl + img,
    }
  })

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      siteName: siteMetadata.title,
      locale: 'en_US',
      type: 'article',
      publishedTime: publishedAt,
      modifiedTime: modifiedAt,
      url: './',
      images: ogImages,
      authors: authorsToshow.length > 0 ? authorsToshow : [siteMetadata.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary,
      images: imageList,
    },
  }
}

export const generateStaticParams = async () => {
  const paths = blogs.map((p) => ({ slug: p.slug.split('/') }))

  return paths
}

function getSeriesInfo(slug: string[]): SeriesInfo | null {
  if (slug.length <= 1) {
    return null
  }

  const seriesSlug = slug[0]

  const seriesInfo = seriesDescriptions.find((s) => s.slug === seriesSlug)

  if (!seriesInfo) {
    return null
  }

  const posts = blogs
    .filter((post) => post.slug.startsWith(`${seriesSlug}/`))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // sort ascending

  return { title: seriesInfo.title, posts }
}

export default async function Page({ params }: { params: { slug: string[] } }) {
  const slug = decodeURI(params.slug.join('/'))
  const series = getSeriesInfo(params.slug)

  // Filter out drafts in production
  const sortedCoreContents = allCoreContent(sortPosts(blogs))
  const postIndex = sortedCoreContents.findIndex((p) => p.slug === slug)
  if (postIndex === -1) {
    return notFound()
  }

  const prev = sortedCoreContents[postIndex + 1]
  const next = sortedCoreContents[postIndex - 1]
  const post = blogs.find((p) => p.slug === slug) as Blog
  const authorList = post?.authors || ['default']
  const authorDetails = authorList.map((author) => {
    const a = findAuthor(authors, author)
    return coreContent(a)
  })
  const mainContent = coreContent(post)
  const jsonLd = post.structuredData
  jsonLd['author'] = authorDetails.map((author) => {
    return {
      '@type': 'Person',
      name: author.name,
    }
  })

  const Layout = layouts[post.layout || defaultLayout]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Layout
        content={mainContent}
        authorDetails={authorDetails}
        next={next}
        prev={prev}
        series={series}
      >
        <MDXContent code={post.body} components={components} toc={post.toc} />
      </Layout>
    </>
  )
}
