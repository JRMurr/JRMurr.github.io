import ListLayout from '@/layouts/ListLayoutWithTags'
import { allCoreContent, sortPosts } from '@/utils/velite'
import { blogs } from '@/velite/generated'
import { genPageMetadata } from 'app/seo'
import siteMetadata from '@/content/siteMetadata'

const POSTS_PER_PAGE = siteMetadata.posts_per_page

export const metadata = genPageMetadata({ title: 'Blog' })

export default function BlogPage() {
  const posts = allCoreContent(sortPosts(blogs))
  const pageNumber = 1
  const initialDisplayPosts = posts.slice(
    POSTS_PER_PAGE * (pageNumber - 1),
    POSTS_PER_PAGE * pageNumber
  )
  const pagination = {
    currentPage: pageNumber,
    totalPages: Math.ceil(posts.length / POSTS_PER_PAGE),
  }

  return (
    <ListLayout
      posts={posts}
      initialDisplayPosts={initialDisplayPosts}
      pagination={pagination}
      title="All Posts"
    />
  )
}
