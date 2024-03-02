import { authors } from '@/velite/generated'
import { MDXLayoutRenderer } from 'pliny/mdx-components'
import AuthorLayout from '@/layouts/AuthorLayout'
import { genPageMetadata } from 'app/seo'

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
        <MDXLayoutRenderer code={body} />
      </AuthorLayout>
    </>
  )
}
