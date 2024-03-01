import { sortPosts, allCoreContent } from '@/utils/velite'
// import { blogs } from 'velite/generated'
import Main from './Main'

export default async function Page() {
  // @MIGRATE TODO: get posts here
  const sortedPosts = sortPosts([])
  const posts = allCoreContent(sortedPosts)
  return <Main posts={posts} />
}
