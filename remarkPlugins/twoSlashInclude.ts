import { Node, Parent } from 'unist-util-visit/lib'
import flatMap from 'unist-util-flatmap'

// @MIGRATE TODO: type visitor better

// A set of includes which can be pulled via a set ID
const includes = new Map<string, string>()

const parsingNewFile = () => includes.clear()

type CodeNode = Node & {
  lang: string
  meta: string | null
  value: string
}

const exportRe = /export=([^ ]*)/

const replaceIncludesInCode = (_map: Map<string, string>, code: string) => {
  const includes = /\/\/ @include: (.*)$/gm
  // Basically run a regex over the code replacing any // @include: thing with
  // 'thing' from the map

  // const toReplace: [index:number, length: number, str: string][] = []
  const toReplace: [number, number, string][] = []

  let match
  while ((match = includes.exec(code)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (match.index === includes.lastIndex) {
      includes.lastIndex++
    }
    const key = match[1]
    const replaceWith = _map.get(key)

    if (!replaceWith) {
      const msg = `Could not find an include with the key: '${key}'.\nThere is: ${Array.from(_map.keys())}.`
      throw new Error(msg)
    }

    toReplace.push([match.index, match[0].length, replaceWith])
  }

  let newCode = code.toString()
  // Go backwards through the found changes so that we can retain index position
  toReplace.reverse().forEach((r) => {
    newCode = newCode.substring(0, r[0]) + r[2] + newCode.substring(r[0] + r[1])
  })
  return newCode
}

export function twoSlashInclude() {
  return (tree: Parent & { lang?: string }) => {
    parsingNewFile()
    flatMap(tree, (node: CodeNode) => {
      if (node.lang !== 'twoslash') {
        const meta = node.meta || ''
        if (node.lang === 'ts' && meta.includes('twoslash')) {
          node.value = replaceIncludesInCode(includes, node.value)
        }
        return [node]
      }
      node.lang = 'ts'
      const meta = node.meta || ''
      const exportMatch = meta.match(exportRe)
      if (exportMatch) {
        const exportName = exportMatch[1]
        includes.set(exportName, node.value)
      }
      return []
    })
  }
}
