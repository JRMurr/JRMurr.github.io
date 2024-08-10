'use client'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'

interface Props {
  //   children: ReactNode
  //   width: number
  //   height: number
  //   src: string
  //   title: string
}

interface ZigFishModule extends EmscriptenModule {
  force_exit: (status: number) => void
  canvas: HTMLCanvasElement
}

const Chess = (p: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moduleRef = useRef<any>(null)

  const loadWasm = async () => {
    // https://emscripten.org/docs/api_reference/module.html#module
    const wasmModule: Partial<ZigFishModule> = {
      print: (text) => {
        console.log('[WASM] ' + text)
      },
      printErr: (text) => {
        console.log('[WASM-ERROR] ' + text)
      },
      get canvas() {
        return canvasRef.current || undefined
      },
      set canvas(_) {},
      onRuntimeInitialized: () => {
        console.log('WASM runtime initialized')
      },
    }

    const { default: zigFishInit } = (await import('./zigfish/zigfish.js')) as {
      default: EmscriptenModuleFactory<ZigFishModule>
    }
    const updatedModule = await zigFishInit(wasmModule)
    moduleRef.current = updatedModule

    return updatedModule
  }

  useEffect(() => {
    const init = loadWasm()
    return () => {
      init.then((wasmModule) => {
        try {
          wasmModule.force_exit(0)
          delete wasmModule['wasmMemory']
        } catch (error) {
          /* empty */
        }
        console.debug('unloading chess wasm')
      })
    }
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
