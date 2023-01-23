// import Link from '@/components/Link'
import PageTitle from '@/components/PageTitle';
import SectionContainer from '@/components/SectionContainer';
import { BlogSEO } from '@/components/SEO';
// import Image from '@/components/Image'
// import Tag from '@/components/Tag'
import siteMetadata from '@/data/siteMetadata';
import ScrollTopAndComment from '@/components/ScrollTopAndComment';
import { ReactNode } from 'react';
import { PostFrontMatter } from 'types/PostFrontMatter';
import { AuthorFrontMatter } from 'types/AuthorFrontMatter';
import Comments from '@/components/comments';
import { SeriesInfo } from 'pages/blog/[...slug]';
import Series from '@/components/Series';

// const editUrl = (fileName) => `${siteMetadata.siteRepo}/blob/master/data/blog/${fileName}`
// const discussUrl = (slug) =>
//   `https://mobile.twitter.com/search?q=${encodeURIComponent(
//     `${siteMetadata.siteUrl}/blog/${slug}`
//   )}`

const postDateTemplate: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
};

interface Props {
  frontMatter: PostFrontMatter;
  authorDetails: AuthorFrontMatter[];
  series?: SeriesInfo;
  children: ReactNode;
}

export default function PostLayout({ frontMatter, authorDetails, children, series }: Props) {
  const { slug, date, title, readingTime } = frontMatter; //tags

  return (
    <SectionContainer>
      <BlogSEO
        url={`${siteMetadata.siteUrl}/blog/${slug}`}
        authorDetails={authorDetails}
        {...frontMatter}
      />
      <ScrollTopAndComment />
      <article>
        <div className="xl:divide-y xl:divide-gray-200 xl:dark:divide-gray-700">
          <header className="pt-6 xl:pb-6">
            <div className="space-y-4 md:space-y-2 text-center">
              <dl className="space-y-10">
                <div>
                  <dt className="sr-only">Published on</dt>
                  <dd className="flex justify-center items-center text-base font-medium leading-6 text-gray-500 dark:text-gray-400">
                    <time dateTime={date}>
                      {new Date(date).toLocaleDateString(siteMetadata.locale, postDateTemplate)}
                    </time>
                    <span className="mx-2">-</span>
                    <div className="flex items-center">
                      <span className="ml-1">{readingTime.text}</span>
                    </div>
                  </dd>
                </div>
              </dl>
              <div>
                <PageTitle>{title}</PageTitle>
              </div>
            </div>
          </header>
          <div
            className="pb-8 divide-y divide-gray-200 xl:divide-y-0 dark:divide-gray-700 xl:grid xl:grid-cols-4 xl:gap-x-6"
            style={{ gridTemplateRows: 'auto 1fr' }}
          >
            <div className="divide-y divide-gray-200 dark:divide-gray-700 xl:pb-0 xl:col-span-4 xl:row-span-2">
              <div className="pt-10 pb-8 prose dark:prose-dark max-w-none">
                <Series series={series} currSlug={slug} />
                {children}
              </div>
              <Comments frontMatter={frontMatter} />
            </div>
          </div>
        </div>
      </article>
    </SectionContainer>
  );
}
