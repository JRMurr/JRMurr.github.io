import { SeriesInfo } from 'pages/blog/[...slug]';
import { useRouter } from 'next/router';
interface Props {
  series?: SeriesInfo;
  currSlug: string;
}
const Series = ({ series, currSlug }: Props) => {
  const router = useRouter();
  if (!series) {
    return null;
  }

  const { title, posts } = series;

  return (
    <div className="pb-2">
      <p>This article is part of the {title} series.</p>
      <select
        defaultValue={`/blog/${currSlug}`}
        onChange={(e) => router.push(e.target.value)}
        className="block w-3/12 px-4 py-2 text-gray-900 bg-white border border-gray-300 rounded-md dark:border-gray-900 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:text-gray-100"
      >
        {posts.map((p) => (
          <option key={p.title} value={`/blog/${p.slug}`}>
            {p.seriesTitle ?? p.title}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Series;
