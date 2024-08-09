'use client'
import { ComponentProps, ReactNode, useEffect, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { Square, CustomSquareStyles } from 'react-chessboard/dist/chessboard/types'

type BaseBoardProps = ComponentProps<typeof Chessboard>

type Move = `${Square}${Square}`

interface StaticBoardProps extends BaseBoardProps {
  type: 'static'
  lastMove?: Move
}

interface PlayableBoard extends BaseBoardProps {
  type: 'playable'
}

type Props = StaticBoardProps | PlayableBoard

const StaticChessBoard = (p: StaticBoardProps) => {
  const { lastMove, ...rest } = p

  const customSquareStyles: CustomSquareStyles = {}

  if (p.lastMove) {
    const from = p.lastMove.slice(0, 2)
    const to = p.lastMove.slice(2)
    const backgroundColor = '#696969' // don't even think of laughing
    customSquareStyles[from] = { backgroundColor }
    customSquareStyles[to] = { backgroundColor }
  }

  return <Chessboard {...rest} arePiecesDraggable={false} customSquareStyles={customSquareStyles} />
}
const PlayableChessboard = (p: PlayableBoard) => {
  return <Chessboard />
}

const Chess = (p: Props) => {
  if (p.type === 'static') {
    return <StaticChessBoard {...p} />
  }
  return <PlayableChessboard {...p} />
}

export default Chess
