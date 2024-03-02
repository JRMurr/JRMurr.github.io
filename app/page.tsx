import { sortPosts, allCoreContent } from '@/utils/velite'
import { blogs } from 'velite/generated'
import Main from './Main'

export default async function Page() {
  const sortedPosts = sortPosts(blogs)
  const posts = allCoreContent(sortedPosts)
  return <Main posts={posts} />
}
