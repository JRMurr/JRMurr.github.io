// import { Toc, TocItem } from '../mdx-plugins/remark-toc-headings'

import type { Blog } from '@/velite/generated'

type Toc = Blog['toc']
type TocItem = Toc[number]

export interface TOCInlineProps {
  toc: Toc
  fromHeading?: number
  toHeading?: number
  asDisclosure?: boolean
  exclude?: string | string[]
  collapse?: boolean
  ulClassName?: string
}

// const createNestedList = (items: TocItem[]): TocItem[] => {
//   const nestedList: TocItem[] = []
//   const stack: TocItem[] = []

//   items.forEach((item) => {
//     const newItem: TocItem = { ...item }

//     while (stack.length > 0 && stack[stack.length - 1].depth >= newItem.depth) {
//       stack.pop()
//     }

//     const parent = stack.length > 0 ? stack[stack.length - 1] : null

//     if (parent) {
//       parent.children = parent.children || []
//       parent.children.push(newItem)
//     } else {
//       nestedList.push(newItem)
//     }

//     stack.push(newItem)
//   })

//   return nestedList
// }

/**
 * Generates an inline table of contents
 * Exclude titles matching this string (new RegExp('^(' + string + ')$', 'i')).
 * If an array is passed the array gets joined with a pipe (new RegExp('^(' + array.join('|') + ')$', 'i')).
 *
 * `asDisclosure` will wrap the TOC in a `details` element with a `summary` element.
 * `collapse` will collapse the TOC when `AsDisclosure` is true.
 *
 * If you are using tailwind css and want to revert to the default HTML list style, set `ulClassName="[&_ul]:list-[revert]"`
 * @param {TOCInlineProps} {
 *   toc,
 *   fromHeading = 1,
 *   toHeading = 6,
 *   asDisclosure = false,
 *   exclude = '',
 *   collapse = false,
 *   ulClassName = '',
 * }
 *
 */
const TOCInline = ({
  toc,
  fromHeading = 0,
  toHeading = 5,
  asDisclosure = false,
  exclude = '',
  collapse = false,
  ulClassName = '',
}: TOCInlineProps) => {
  const re = Array.isArray(exclude)
    ? new RegExp('^(' + exclude.join('|') + ')$', 'i')
    : new RegExp('^(' + exclude + ')$', 'i')

  const filteredToc = toc.filter(
    (heading) => heading.depth >= fromHeading && heading.depth <= toHeading //&& !re.test(heading.value)
  )

  const createList = (items: TocItem[] | undefined) => {
    if (!items || items.length === 0) {
      return null
    }

    return (
      <ul className={ulClassName}>
        {items.map((item, index) => (
          <li key={index}>
            <a href={item.url}>{item.title}</a>
            {createList(item.items as TocItem[])}
          </li>
        ))}
      </ul>
    )
  }

  //   const nestedList = createNestedList(filteredToc)

  return (
    <>
      {asDisclosure ? (
        <details open={!collapse}>
          <summary className="ml-6 pb-2 pt-2 text-xl font-bold">Table of Contents</summary>
          <div className="ml-6">{createList(filteredToc)}</div>
        </details>
      ) : (
        createList(filteredToc)
      )}
    </>
  )
}

export default TOCInline
