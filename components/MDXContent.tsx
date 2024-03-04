import React from 'react'
import * as _jsx_runtime from 'react/jsx-runtime'
// import ReactDOM from 'react-dom'

const getMDXComponent = (
  code: string,
  globals: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.ComponentType<any> => {
  const scope = { _jsx_runtime, ...globals }
  const fn = new Function(...Object.keys(scope), code)
  return fn(...Object.values(scope)).default
  // const f = fn(...Object.values(scope)).default
  // console.log(code)
  // return f
}

export const useMDXComponent = (
  code: string,
  globals: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): React.ComponentType<any> => {
  return React.useMemo(() => getMDXComponent(code, globals), [code, globals])
}

interface MdxProps {
  code: string
  components?: Record<string, React.ComponentType>
  [key: string]: unknown
}

export const MDXContent = ({ code, components, ...rest }: MdxProps) => {
  const Component = useMDXComponent(code)
  // const componentsMerged =

  const t = <Component components={components} {...rest} />
  // console.log(t)
  return t
}
