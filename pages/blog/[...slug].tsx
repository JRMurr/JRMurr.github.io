import fs from 'fs';
import path from 'path';
import PageTitle from '@/components/PageTitle';
import generateRss from '@/lib/generate-rss';
import { MDXLayoutRenderer } from '@/components/MDXComponents';
import { formatSlug, getAllFilesFrontMatter, getFileBySlug, getFiles } from '@/lib/mdx';
import { GetStaticProps, InferGetStaticPropsType } from 'next';
import { AuthorFrontMatter } from 'types/AuthorFrontMatter';
import { PostFrontMatter } from 'types/PostFrontMatter';
import { Toc } from 'types/Toc';
import matter from 'gray-matter';
import { readFileIfExists } from '@/lib/utils/files';

export interface SeriesInfo {
  title: string;
  posts: Array<PostFrontMatter>;
}

interface SeriesMatter {
  title: string;
  tags?: string[];
  summary?: string;
}

const root = process.cwd();

const DEFAULT_LAYOUT = 'PostLayout';

export async function getStaticPaths() {
  const posts = getFiles('blog');
  return {
    paths: posts.map((p) => ({
      params: {
        slug: formatSlug(p).split('/'),
      },
    })),
    fallback: false,
  };
}

function getSeriesInfo(slug: string[], allPosts: Array<PostFrontMatter>): SeriesInfo | null {
  if (slug.length <= 1) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [seriesPrefix, ..._rest] = slug;

  const infoPath = path.join(root, 'data', 'blog', seriesPrefix, 'info.txt');
  const infoStr = readFileIfExists(infoPath);
  const info = infoStr ? (matter(infoStr).data as SeriesMatter) : null;
  const posts = allPosts
    .filter((post) => post.slug.startsWith(`${seriesPrefix}/`))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // sort ascending
  return { title: info.title ?? seriesPrefix, posts };
}

// @ts-ignore
export const getStaticProps: GetStaticProps<{
  post: {
    mdxSource: string;
    toc: Toc;
    frontMatter: PostFrontMatter;
  };
  authorDetails: AuthorFrontMatter[];
  series?: SeriesInfo;
}> = async ({ params }) => {
  const slugArr = params.slug as string[];
  const slug = slugArr.join('/');
  const allPosts = await getAllFilesFrontMatter('blog');
  const post = await getFileBySlug('blog', slug);

  const series = getSeriesInfo(slugArr, allPosts);

  // @ts-ignore
  const authorList = post.frontMatter.authors || ['default'];
  const authorPromise = authorList.map(async (author) => {
    const authorResults = await getFileBySlug('authors', [author]);
    return authorResults.frontMatter;
  });
  const authorDetails = await Promise.all(authorPromise);

  // rss
  if (allPosts.length > 0) {
    const rss = generateRss(allPosts);
    fs.writeFileSync('./public/feed.xml', rss);
  }

  return {
    props: {
      post,
      authorDetails,
      series,
    },
  };
};

export default function Blog({
  post,
  authorDetails,
  series,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { mdxSource, toc, frontMatter } = post;

  return (
    <>
      {'draft' in frontMatter && frontMatter.draft !== true ? (
        <MDXLayoutRenderer
          layout={frontMatter.layout || DEFAULT_LAYOUT}
          toc={toc}
          mdxSource={mdxSource}
          frontMatter={frontMatter}
          authorDetails={authorDetails}
          series={series}
        />
      ) : (
        <div className="mt-24 text-center">
          <PageTitle>
            Under Construction{' '}
            <span role="img" aria-label="roadwork sign">
              🚧
            </span>
          </PageTitle>
        </div>
      )}
    </>
  );
}
