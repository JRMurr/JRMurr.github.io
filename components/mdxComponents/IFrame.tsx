import { ReactNode } from 'react'

interface Props {
  children: ReactNode
  width: number
  height: number
  src: string
  title: string
}

const IFrame = ({ children, title, width, height, src }: Props) => {
  // "https://lichess.org/study/embed/GDCFGo2g/DBUXdibd#2"
  return (
    // allowTransparency={true}
    <iframe title={title} width={width} height={height} src={src}>
      {children}
    </iframe>
  )
}

export default IFrame
