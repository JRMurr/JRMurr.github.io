'use client'

import { DetailedHTMLProps, HTMLAttributes } from 'react'
import { useKBar } from 'kbar/src' // @MIGRATE TODO: might need to drop src when switching to real dep

/**
 * Button wrapper component that triggers the KBar modal on click.
 *
 * @return {*}
 */
export const KBarButton = ({
  children,
  ...rest
}: DetailedHTMLProps<HTMLAttributes<HTMLButtonElement>, HTMLButtonElement>) => {
  const { query } = useKBar()

  return (
    <button {...rest} onClick={() => query.toggle()}>
      {children}
    </button>
  )
}
