import { authors } from '@/velite/generated'
import AuthorLayout from '@/layouts/AuthorLayout'
import { genPageMetadata } from 'app/seo'
import { MDXContent } from '@/components/MDXContent'

export const metadata = genPageMetadata({ title: 'About' })

export default function Page() {
  const author = authors.find((p) => p.slug === 'default')
  if (author === undefined) {
    throw new Error('No default author')
  }
  const { body, ...mainContent } = author

  return (
    <>
      <AuthorLayout content={mainContent}>
        <MDXContent code={body} />
      </AuthorLayout>
    </>
  )
}
