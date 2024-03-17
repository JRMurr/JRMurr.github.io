'use client'

import { useState } from 'react'
import siteMetadata from '@/content/siteMetadata'
import { Giscus } from './comments/giscus'

export default function Comments() {
  const [loadComments, setLoadComments] = useState(false)
  return (
    <>
      {!loadComments && <button onClick={() => setLoadComments(true)}>Load Comments</button>}
      {siteMetadata.comments && loadComments && <Giscus {...siteMetadata.comments.giscusConfig} />}
    </>
  )
}
