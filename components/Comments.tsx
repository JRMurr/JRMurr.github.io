'use client'

import { Comments as CommentsComponent } from 'pliny/comments/index.js'
import { useState } from 'react'
import siteMetadata from '@/content/siteMetadata'

export default function Comments({ slug }: { slug: string }) {
  const [loadComments, setLoadComments] = useState(false)
  return (
    <>
      {!loadComments && <button onClick={() => setLoadComments(true)}>Load Comments</button>}
      {/* @MIGRATE TODO: this */}
      {/* {siteMetadata.comments && loadComments && (
        <CommentsComponent commentsConfig={siteMetadata.comments} slug={slug} />
      )} */}
    </>
  )
}
