'use client'
import { ReactNode, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

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
    // https://emscripten.org/docs/api_reference/module.html#module
    const wasmModule = {
      print: (text) => {
        console.log('[WASM] ' + text)
      },
      printErr: (text) => {
        console.log('[WASM-ERROR] ' + text)
      },
      get canvas() {
        return canvasRef.current
      },
      set canvas(_) {},
      onRuntimeInitialized: () => {
        console.log('WASM runtime initialized')
      },
    }

    const { default: zigFishInit } = await import('./zigfish/zigfish.js')
    await zigFishInit(wasmModule)
  }

  useEffect(() => {
    loadWasm()
  }, [])

  return (
    <canvas
      ref={canvasRef}
      id="canvas"
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={-1}
    ></canvas>
  )
}

export default Chess
