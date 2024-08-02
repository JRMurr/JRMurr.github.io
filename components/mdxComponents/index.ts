import TOCInline from './TOCInline'
// import BlogNewsletterForm from 'pliny/ui/BlogNewsletterForm'
import Image from './Image'
import CustomLink from './Link'
import TableWrapper from './TableWrapper'
import Note from './Note'
import Pre from './Pre'
import IFrame from './IFrame'
import { Chess } from './chess'

export const components = {
  Image,
  TOCInline,
  IFrame,
  a: CustomLink,
  pre: Pre,
  table: TableWrapper,
  Note: Note,
  Chess,
  // BlogNewsletterForm,
}

export default components
