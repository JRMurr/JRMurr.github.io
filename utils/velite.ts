/**
 * ============
 * Replacement fucntions for pliny/utils/contentlayer
 * ============
 */

import { authors } from 'velite/generated'

export type MDXDocument = {
  body: string
}

export function dateSortDesc(a: string, b: string) {
  if (a > b) return -1
  if (a < b) return 1
  return 0
}

export function sortPosts<T extends { date: string }>(allBlogs: T[]) {
  return allBlogs.sort((a, b) => dateSortDesc(a.date, b.date))
}

const authorMap = new Map(authors.map((a) => [a.slug, a]))

export function findAuthor(author: string) {
  const a = authorMap.get(author)

  if (!a) {
    throw new Error(`author ${author} not found`)
  }

  return a
}

export type CoreContent<T> = Omit<T, 'body' | '_raw' | '_id'>

export const omit = <Obj, Keys extends keyof Obj>(obj: Obj, ...keys: Keys[]): Omit<Obj, Keys> => {
  const result = Object.assign({}, obj)
  keys.forEach((key) => {
    delete result[key]
  })
  return result
}

export function coreContent<T extends MDXDocument>(x: T) {
  return omit(x, 'body')
}

const isProduction = process.env.NODE_ENV === 'production'

export function allCoreContent<T extends MDXDocument>(x: T[]) {
  const cleaned = x.map(coreContent)

  if (isProduction) return cleaned.filter((c) => !('draft' in c && c.draft === true))

  return cleaned
}
