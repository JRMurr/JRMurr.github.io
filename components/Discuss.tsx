import siteMetadata from '@/content/siteMetadata'
import Link from './mdxComponents/Link'
import { ReactNode } from 'react'
import Comments from './Comments'

interface Props {
  path: string
  children?: ReactNode
}

const editUrl = (path: string) => `${siteMetadata.siteRepo}/blob/main/content/${path}.md`
const discussUrl = (path: string) =>
  `https://mobile.twitter.com/search?q=${encodeURIComponent(`${siteMetadata.siteUrl}/${path}`)}`

export default function Discuss({ path, children }: Props) {
  return (
    <div>
      <div className="pb-6 pt-6 text-sm text-gray-700 dark:text-gray-300">
        <Link href={discussUrl(path)} rel="nofollow">
          Discuss on Twitter
        </Link>
        {` • `}
        <Link href={editUrl(path)}>View on GitHub</Link>
      </div>
      {siteMetadata.comments && (
        <div className="pb-6 pt-6 text-center text-gray-700 dark:text-gray-300" id="comment">
          <Comments />
        </div>
      )}
      {children}
    </div>
  )
}
