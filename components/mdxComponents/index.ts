import TOCInline from './TOCInline'
// import BlogNewsletterForm from 'pliny/ui/BlogNewsletterForm'
import Image from './Image'
import CustomLink from './Link'
import TableWrapper from './TableWrapper'
import Note from './Note'
import Pre from './Pre'

export const components = {
  Image,
  TOCInline,
  a: CustomLink,
  pre: Pre,
  table: TableWrapper,
  Note: Note,
  // BlogNewsletterForm,
}

export default components
