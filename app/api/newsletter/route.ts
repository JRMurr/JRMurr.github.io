import { NewsletterAPI } from 'pliny/newsletter/index.js'
import siteMetadata from '@/content/siteMetadata'

const handler = NewsletterAPI({
  // @ts-ignore
  provider: siteMetadata.newsletter.provider,
})

export { handler as GET, handler as POST }
