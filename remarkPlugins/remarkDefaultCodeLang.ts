import { Parent, visit } from 'unist-util-visit/lib/index.js'

export function remarkDefaultCodeLang() {
  return (tree: Parent & { lang?: string }) => {
    const vistFn = (node: Parent & { lang?: string }, index, parent: Parent) => {
      if (!node.lang) {
        node.lang = 'text'
      }
    }
    return visit(tree, 'code', vistFn)
  }
}
