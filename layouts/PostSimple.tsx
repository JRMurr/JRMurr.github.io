import { ReactNode } from 'react'
import { formatDate } from '@/utils/formatDate'
import { CoreContent } from '@/utils/velite'
import type { Blog } from '@/velite/generated'
import Comments from '@/components/Comments'
import Link from '@/components/mdxComponents/Link'
import PageTitle from '@/components/PageTitle'
import SectionContainer from '@/components/SectionContainer'
import siteMetadata from '@/content/siteMetadata'
import ScrollTopAndComment from '@/components/ScrollTopAndComment'
import Series from '@/components/Series'
import { SeriesInfo } from 'app/blog/[...slug]/page'
import Discuss from '@/components/Discuss'

interface LayoutProps {
  content: CoreContent<Blog>
  children: ReactNode
  series?: SeriesInfo
  next?: { path: string; title: string }
  prev?: { path: string; title: string }
}

export default function PostLayout({ content, next, prev, series, children }: LayoutProps) {
  const { path, slug,realPath, date, title, metadata } = content

  return (
    <SectionContainer>
      <ScrollTopAndComment />
      <article>
        <div>
          <header>
            <div className="space-y-1 border-b border-gray-200 pb-10 text-center dark:border-gray-700">
              <dl>
                <div>
                  <dt className="sr-only">Published on</dt>
                  <dd className="text-base font-medium leading-6 text-gray-500 dark:text-gray-400">
                    <time dateTime={date}>{formatDate(date, siteMetadata.locale)}</time>
                    <span className="mx-2">-</span>
                    <span className="ml-1">{metadata.readingTime} min read</span>
                  </dd>
                </div>
              </dl>
              <div>
                <PageTitle>{title}</PageTitle>
              </div>
            </div>
          </header>
          <div className="grid-rows-[auto_1fr] divide-y divide-gray-200 pb-8 dark:divide-gray-700 xl:divide-y-0">
            <div className="divide-y divide-gray-200 dark:divide-gray-700 xl:col-span-3 xl:row-span-2 xl:pb-0">
              <div className="prose max-w-none pb-8 pt-10 dark:prose-invert">
                <Series series={series} currSlug={slug} />
                {children}
              </div>
              <Discuss path={realPath} />
            </div>

            <footer>
              <div className="flex flex-col text-sm font-medium sm:flex-row sm:justify-between sm:text-base">
                {prev && prev.path && (
                  <div className="pt-4 xl:pt-8">
                    <Link
                      href={`/${prev.path}`}
                      className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                      aria-label={`Previous post: ${prev.title}`}
                    >
                      &larr; {prev.title}
                    </Link>
                  </div>
                )}
                {next && next.path && (
                  <div className="pt-4 xl:pt-8">
                    <Link
                      href={`/${next.path}`}
                      className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                      aria-label={`Next post: ${next.title}`}
                    >
                      {next.title} &rarr;
                    </Link>
                  </div>
                )}
              </div>
            </footer>
          </div>
        </div>
      </article>
    </SectionContainer>
  )
}
