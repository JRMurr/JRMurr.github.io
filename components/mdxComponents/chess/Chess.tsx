'use client'
import { ReactNode, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
// import zigFishInit from '../../../public/static/zigfish-wasm/zigfish'

interface Props {
  //   children: ReactNode
  //   width: number
  //   height: number
  //   src: string
  //   title: string
}

const Chess = (p: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const loadWasm = async () => {
    'use client'
    const wasmModule = {
      print: (text) => {
        console.log('[WASM] ' + text)
      },
      printErr: (text) => {
        console.log('[WASM-ERROR] ' + text)
      },
      canvas: canvasRef,
      onRuntimeInitialized: () => {
        console.log('WASM runtime initialized')
      },
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { default: zigFishInit } = await import('../../../public/static/zigfish-wasm/zigfish')
    // TODO: swc is optimzing the zigfish js file and removeing some of the guards it has in place checking if window is defined
    await zigFishInit(wasmModule)
    console.log('loaded!')
  }

  useEffect(() => {
    if (window !== undefined) {
      loadWasm()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      // class="emscripten"
      id="canvas"
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={-1}
    ></canvas>
  )
}

export default Chess
