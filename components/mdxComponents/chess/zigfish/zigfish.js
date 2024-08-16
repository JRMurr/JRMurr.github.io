var zigfish = (() => {
  var _scriptName = import.meta.url

  return function (moduleArg = {}) {
    var moduleRtn

    // Support for growable heap + pthreads, where the buffer may change, so JS views
    // must be updated.
    function GROWABLE_HEAP_I8() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAP8
    }

    function GROWABLE_HEAP_U8() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAPU8
    }

    function GROWABLE_HEAP_I16() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAP16
    }

    function GROWABLE_HEAP_U16() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAPU16
    }

    function GROWABLE_HEAP_I32() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAP32
    }

    function GROWABLE_HEAP_U32() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAPU32
    }

    function GROWABLE_HEAP_F32() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAPF32
    }

    function GROWABLE_HEAP_F64() {
      if (wasmMemory.buffer != HEAP8.buffer) {
        updateMemoryViews()
      }
      return HEAPF64
    }

    // include: shell.js
    // The Module object: Our interface to the outside world. We import
    // and export values on it. There are various ways Module can be used:
    // 1. Not defined. We create it here
    // 2. A function parameter, function(moduleArg) => Promise<Module>
    // 3. pre-run appended it, var Module = {}; ..generated code..
    // 4. External script tag defines var Module.
    // We need to check if Module already exists (e.g. case 3 above).
    // Substitution will be replaced with actual code on later stage of the build,
    // this way Closure Compiler will not mangle it (e.g. case 4. above).
    // Note that if you want to run closure, and also to use Module
    // after the generated code, you will need to define   var Module = {};
    // before the code. Then that object will be used in the code, and you
    // can continue to use Module afterwards as well.
    var Module = moduleArg

    // Set up the promise that indicates the Module is initialized
    var readyPromiseResolve, readyPromiseReject

    var readyPromise = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve
      readyPromiseReject = reject
    })

    // Determine the runtime environment we are in. You can customize this by
    // setting the ENVIRONMENT setting at compile time (see settings.js).
    // Attempt to auto-detect the environment
    var ENVIRONMENT_IS_WEB = typeof window == 'object'

    var ENVIRONMENT_IS_WORKER = typeof importScripts == 'function'

    // N.b. Electron.js environment is simultaneously a NODE-environment, but
    // also a web environment.
    var ENVIRONMENT_IS_NODE =
      typeof process == 'object' &&
      typeof process.versions == 'object' &&
      typeof process.versions.node == 'string'

    // Three configurations we can be running in:
    // 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
    // 2) We could be the application main() thread proxied to worker. (with Emscripten -sPROXY_TO_WORKER) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
    // 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)
    // The way we signal to a worker that it is hosting a pthread is to construct
    // it with a specific name.
    var ENVIRONMENT_IS_PTHREAD = ENVIRONMENT_IS_WORKER && self.name == 'em-pthread'

    // --pre-jses are emitted after the Module integration code, so that they can
    // refer to Module (if they choose; they can also define Module)
    // include: /build/source/wasm-templates/prepend.js
    // https://github.com/emscripten-core/emscripten/issues/19996
    if (!global.window) {
      global.window = {
        encodeURIComponent: encodeURIComponent,
        location: location,
      }
    }

    Module['force_exit'] = _emscripten_force_exit

    // end include: /build/source/wasm-templates/prepend.js
    // Sometimes an existing Module object exists with properties
    // meant to overwrite the default module functionality. Here
    // we collect those properties and reapply _after_ we configure
    // the current environment's defaults to avoid having to be so
    // defensive during initialization.
    var moduleOverrides = Object.assign({}, Module)

    var arguments_ = []

    var thisProgram = './this.program'

    var quit_ = (status, toThrow) => {
      throw toThrow
    }

    // `/` should be present at the end if `scriptDirectory` is not empty
    var scriptDirectory = ''

    function locateFile(path) {
      if (Module['locateFile']) {
        return Module['locateFile'](path, scriptDirectory)
      }
      return scriptDirectory + path
    }

    // Hooks that are implemented differently in different runtime environments.
    var readAsync, readBinary

    // Note that this includes Node.js workers when relevant (pthreads is enabled).
    // Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
    // ENVIRONMENT_IS_NODE.
    if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
      if (ENVIRONMENT_IS_WORKER) {
        // Check worker, not web, since window could be polyfilled
        scriptDirectory = self.location.href
      } else if (typeof document != 'undefined' && document.currentScript) {
        // web
        scriptDirectory = document.currentScript.src
      }
      // When MODULARIZE, this JS may be executed later, after document.currentScript
      // is gone, so we saved it, and we use it here instead of any other info.
      if (_scriptName) {
        scriptDirectory = _scriptName
      }
      // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
      // otherwise, slice off the final part of the url to find the script directory.
      // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
      // and scriptDirectory will correctly be replaced with an empty string.
      // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
      // they are removed because they could contain a slash.
      if (scriptDirectory.startsWith('blob:')) {
        scriptDirectory = ''
      } else {
        scriptDirectory = scriptDirectory.substr(
          0,
          scriptDirectory.replace(/[?#].*/, '').lastIndexOf('/') + 1
        )
      }
      {
        // include: web_or_worker_shell_read.js
        if (ENVIRONMENT_IS_WORKER) {
          readBinary = (url) => {
            var xhr = new XMLHttpRequest()
            xhr.open('GET', url, false)
            xhr.responseType = 'arraybuffer'
            xhr.send(null)
            return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response))
          }
        }
        readAsync = (url) => {
          // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
          // See https://github.com/github/fetch/pull/92#issuecomment-140665932
          // Cordova or Electron apps are typically loaded from a file:// url.
          // So use XHR on webview if URL is a file URL.
          if (isFileURI(url)) {
            return new Promise((reject, resolve) => {
              var xhr = new XMLHttpRequest()
              xhr.open('GET', url, true)
              xhr.responseType = 'arraybuffer'
              xhr.onload = () => {
                if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
                  // file URLs can return 0
                  resolve(xhr.response)
                }
                reject(xhr.status)
              }
              xhr.onerror = reject
              xhr.send(null)
            })
          }
          return fetch(url, {
            credentials: 'same-origin',
          }).then((response) => {
            if (response.ok) {
              return response.arrayBuffer()
            }
            return Promise.reject(new Error(response.status + ' : ' + response.url))
          })
        }
      }
    } // end include: web_or_worker_shell_read.js
    else {
    }

    var out = Module['print'] || console.log.bind(console)

    var err = Module['printErr'] || console.error.bind(console)

    // Merge back in the overrides
    Object.assign(Module, moduleOverrides)

    // Free the object hierarchy contained in the overrides, this lets the GC
    // reclaim data used.
    moduleOverrides = null

    // Emit code to handle expected values on the Module object. This applies Module.x
    // to the proper local x. This has two benefits: first, we only emit it if it is
    // expected to arrive, and second, by using a local everywhere else that can be
    // minified.
    if (Module['arguments']) arguments_ = Module['arguments']

    if (Module['thisProgram']) thisProgram = Module['thisProgram']

    if (Module['quit']) quit_ = Module['quit']

    // perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
    // end include: shell.js
    // include: preamble.js
    // === Preamble library stuff ===
    // Documentation for the public APIs defined in this file must be updated in:
    //    site/source/docs/api_reference/preamble.js.rst
    // A prebuilt local version of the documentation is available at:
    //    site/build/text/docs/api_reference/preamble.js.txt
    // You can also build docs locally as HTML or other formats in site/
    // An online HTML version (which may be of a different version of Emscripten)
    //    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
    // include: runtime_pthread.js
    // Pthread Web Worker handling code.
    // This code runs only on pthread web workers and handles pthread setup
    // and communication with the main thread via postMessage.
    if (ENVIRONMENT_IS_PTHREAD) {
      var wasmPromiseResolve
      var wasmPromiseReject
      // Thread-local guard variable for one-time init of the JS state
      var initializedJS = false
      function threadPrintErr(...args) {
        var text = args.join(' ')
        console.error(text)
      }
      if (!Module['printErr']) err = threadPrintErr
      function threadAlert(...args) {
        var text = args.join(' ')
        postMessage({
          cmd: 'alert',
          text: text,
          threadId: _pthread_self(),
        })
      }
      self.alert = threadAlert
      Module['instantiateWasm'] = (info, receiveInstance) =>
        new Promise((resolve, reject) => {
          wasmPromiseResolve = (module) => {
            // Instantiate from the module posted from the main thread.
            // We can just use sync instantiation in the worker.
            var instance = new WebAssembly.Instance(module, getWasmImports())
            // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193,
            // the above line no longer optimizes out down to the following line.
            // When the regression is fixed, we can remove this if/else.
            receiveInstance(instance)
            resolve()
          }
          wasmPromiseReject = reject
        })
      // Turn unhandled rejected promises into errors so that the main thread will be
      // notified about them.
      self.onunhandledrejection = (e) => {
        throw e.reason || e
      }
      function handleMessage(e) {
        try {
          var msgData = e['data']
          //dbg('msgData: ' + Object.keys(msgData));
          var cmd = msgData['cmd']
          if (cmd === 'load') {
            // Preload command that is called once per worker to parse and load the Emscripten code.
            // Until we initialize the runtime, queue up any further incoming messages.
            let messageQueue = []
            self.onmessage = (e) => messageQueue.push(e)
            // And add a callback for when the runtime is initialized.
            self.startWorker = (instance) => {
              // Notify the main thread that this thread has loaded.
              postMessage({
                cmd: 'loaded',
              })
              // Process any messages that were queued before the thread was ready.
              for (let msg of messageQueue) {
                handleMessage(msg)
              }
              // Restore the real message handler.
              self.onmessage = handleMessage
            }
            // Use `const` here to ensure that the variable is scoped only to
            // that iteration, allowing safe reference from a closure.
            for (const handler of msgData['handlers']) {
              // The the main module has a handler for a certain even, but no
              // handler exists on the pthread worker, then proxy that handler
              // back to the main thread.
              if (!Module[handler] || Module[handler].proxy) {
                Module[handler] = (...args) => {
                  postMessage({
                    cmd: 'callHandler',
                    handler: handler,
                    args: args,
                  })
                }
                // Rebind the out / err handlers if needed
                if (handler == 'print') out = Module[handler]
                if (handler == 'printErr') err = Module[handler]
              }
            }
            wasmMemory = msgData['wasmMemory']
            updateMemoryViews()
            wasmOffsetConverter = resetPrototype(
              WasmOffsetConverter,
              msgData['wasmOffsetConverter']
            )
            wasmPromiseResolve(msgData['wasmModule'])
          } else if (cmd === 'run') {
            // Pass the thread address to wasm to store it for fast access.
            __emscripten_thread_init(
              msgData['pthread_ptr'],
              /*is_main=*/ 0,
              /*is_runtime=*/ 0,
              /*can_block=*/ 1,
              0,
              0
            )
            // Await mailbox notifications with `Atomics.waitAsync` so we can start
            // using the fast `Atomics.notify` notification path.
            __emscripten_thread_mailbox_await(msgData['pthread_ptr'])
            // Also call inside JS module to set up the stack frame for this pthread in JS module scope
            establishStackSpace()
            PThread.receiveObjectTransfer(msgData)
            PThread.threadInitTLS()
            if (!initializedJS) {
              initializedJS = true
            }
            try {
              invokeEntryPoint(msgData['start_routine'], msgData['arg'])
            } catch (ex) {
              if (ex != 'unwind') {
                // The pthread "crashed".  Do not call `_emscripten_thread_exit` (which
                // would make this thread joinable).  Instead, re-throw the exception
                // and let the top level handler propagate it back to the main thread.
                throw ex
              }
            }
          } else if (cmd === 'cancel') {
            // Main thread is asking for a pthread_cancel() on this thread.
            if (_pthread_self()) {
              __emscripten_thread_exit(-1)
            }
          } else if (msgData.target === 'setimmediate') {
          } // no-op
          else if (cmd === 'checkMailbox') {
            if (initializedJS) {
              checkMailbox()
            }
          } else if (cmd) {
            // The received message looks like something that should be handled by this message
            // handler, (since there is a cmd field present), but is not one of the
            // recognized commands:
            err(`worker: received unknown command ${cmd}`)
            err(msgData)
          }
        } catch (ex) {
          __emscripten_thread_crashed()
          throw ex
        }
      }
      self.onmessage = handleMessage
    }

    // ENVIRONMENT_IS_PTHREAD
    // end include: runtime_pthread.js
    var wasmBinary

    if (Module['wasmBinary']) wasmBinary = Module['wasmBinary']

    // end include: base64Utils.js
    // Wasm globals
    var wasmMemory

    // For sending to workers.
    var wasmModule

    //========================================
    // Runtime essentials
    //========================================
    // whether we are quitting the application. no code should run after this.
    // set in exit() and abort()
    var ABORT = false

    // set by exit() and abort().  Passed to 'onExit' handler.
    // NOTE: This is also used as the process return code code in shell environments
    // but only when noExitRuntime is false.
    var EXITSTATUS

    // Memory management
    var /** @type {!Int8Array} */ HEAP8,
      /** @type {!Uint8Array} */ HEAPU8,
      /** @type {!Int16Array} */ HEAP16,
      /** @type {!Uint16Array} */ HEAPU16,
      /** @type {!Int32Array} */ HEAP32,
      /** @type {!Uint32Array} */ HEAPU32,
      /** @type {!Float32Array} */ HEAPF32,
      /** @type {!Float64Array} */ HEAPF64

    // include: runtime_shared.js
    function updateMemoryViews() {
      var b = wasmMemory.buffer
      Module['HEAP8'] = HEAP8 = new Int8Array(b)
      Module['HEAP16'] = HEAP16 = new Int16Array(b)
      Module['HEAPU8'] = HEAPU8 = new Uint8Array(b)
      Module['HEAPU16'] = HEAPU16 = new Uint16Array(b)
      Module['HEAP32'] = HEAP32 = new Int32Array(b)
      Module['HEAPU32'] = HEAPU32 = new Uint32Array(b)
      Module['HEAPF32'] = HEAPF32 = new Float32Array(b)
      Module['HEAPF64'] = HEAPF64 = new Float64Array(b)
    }

    // end include: runtime_shared.js
    // In non-standalone/normal mode, we create the memory here.
    // include: runtime_init_memory.js
    // Create the wasm memory. (Note: this only applies if IMPORTED_MEMORY is defined)
    // check for full engine support (use string 'subarray' to avoid closure compiler confusion)
    if (!ENVIRONMENT_IS_PTHREAD) {
      if (Module['wasmMemory']) {
        wasmMemory = Module['wasmMemory']
      } else {
        var INITIAL_MEMORY = Module['INITIAL_MEMORY'] || 16777216
        wasmMemory = new WebAssembly.Memory({
          initial: INITIAL_MEMORY / 65536,
          // In theory we should not need to emit the maximum if we want "unlimited"
          // or 4GB of memory, but VMs error on that atm, see
          // https://github.com/emscripten-core/emscripten/issues/14130
          // And in the pthreads case we definitely need to emit a maximum. So
          // always emit one.
          maximum: 2147483648 / 65536,
          shared: true,
        })
        if (!(wasmMemory.buffer instanceof SharedArrayBuffer)) {
          err(
            'requested a shared WebAssembly.Memory but the returned buffer is not a SharedArrayBuffer, indicating that while the browser has SharedArrayBuffer it does not have WebAssembly threads support - you may need to set a flag'
          )
          if (ENVIRONMENT_IS_NODE) {
            err(
              '(on node you may need: --experimental-wasm-threads --experimental-wasm-bulk-memory and/or recent version)'
            )
          }
          throw Error('bad memory')
        }
      }
      updateMemoryViews()
    }

    // end include: runtime_init_memory.js
    // include: runtime_stack_check.js
    // end include: runtime_stack_check.js
    // include: runtime_assertions.js
    // end include: runtime_assertions.js
    var __ATPRERUN__ = []

    // functions called before the runtime is initialized
    var __ATINIT__ = []

    // functions called during startup
    var __ATMAIN__ = []

    // functions called when main() is to be run
    var __ATEXIT__ = []

    // functions called during shutdown
    var __ATPOSTRUN__ = []

    // functions called after the main() is called
    var runtimeInitialized = false

    var runtimeExited = false

    function preRun() {
      if (Module['preRun']) {
        if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']]
        while (Module['preRun'].length) {
          addOnPreRun(Module['preRun'].shift())
        }
      }
      callRuntimeCallbacks(__ATPRERUN__)
    }

    function initRuntime() {
      runtimeInitialized = true
      if (ENVIRONMENT_IS_PTHREAD) return
      if (!Module['noFSInit'] && !FS.init.initialized) FS.init()
      FS.ignorePermissions = false
      TTY.init()
      callRuntimeCallbacks(__ATINIT__)
    }

    function preMain() {
      if (ENVIRONMENT_IS_PTHREAD) return
      // PThreads reuse the runtime from the main thread.
      callRuntimeCallbacks(__ATMAIN__)
    }

    function exitRuntime() {
      if (ENVIRONMENT_IS_PTHREAD) return
      // PThreads reuse the runtime from the main thread.
      ___funcs_on_exit()
      // Native atexit() functions
      callRuntimeCallbacks(__ATEXIT__)
      FS.quit()
      TTY.shutdown()
      PThread.terminateAllThreads()
      runtimeExited = true
    }

    function postRun() {
      if (ENVIRONMENT_IS_PTHREAD) return
      // PThreads reuse the runtime from the main thread.
      if (Module['postRun']) {
        if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']]
        while (Module['postRun'].length) {
          addOnPostRun(Module['postRun'].shift())
        }
      }
      callRuntimeCallbacks(__ATPOSTRUN__)
    }

    function addOnPreRun(cb) {
      __ATPRERUN__.unshift(cb)
    }

    function addOnInit(cb) {
      __ATINIT__.unshift(cb)
    }

    function addOnPostRun(cb) {
      __ATPOSTRUN__.unshift(cb)
    }

    // include: runtime_math.js
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
    // end include: runtime_math.js
    // A counter of dependencies for calling run(). If we need to
    // do asynchronous work before running, increment this and
    // decrement it. Incrementing must happen in a place like
    // Module.preRun (used by emcc to add file preloading).
    // Note that you can add dependencies in preRun, even though
    // it happens right before run - run will be postponed until
    // the dependencies are met.
    var runDependencies = 0

    var runDependencyWatcher = null

    var dependenciesFulfilled = null

    // overridden to take different actions when all run dependencies are fulfilled
    function getUniqueRunDependency(id) {
      return id
    }

    function addRunDependency(id) {
      runDependencies++
      Module['monitorRunDependencies']?.(runDependencies)
    }

    function removeRunDependency(id) {
      runDependencies--
      Module['monitorRunDependencies']?.(runDependencies)
      if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
          clearInterval(runDependencyWatcher)
          runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
          var callback = dependenciesFulfilled
          dependenciesFulfilled = null
          callback()
        }
      }
    }

    /** @param {string|number=} what */ function abort(what) {
      Module['onAbort']?.(what)
      what = 'Aborted(' + what + ')'
      // TODO(sbc): Should we remove printing and leave it up to whoever
      // catches the exception?
      err(what)
      ABORT = true
      EXITSTATUS = 1
      what += '. Build with -sASSERTIONS for more info.'
      // Use a wasm runtime error, because a JS error might be seen as a foreign
      // exception, which means we'd run destructors on it. We need the error to
      // simply make the program stop.
      // FIXME This approach does not work in Wasm EH because it currently does not assume
      // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
      // a trap or not based on a hidden field within the object. So at the moment
      // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
      // allows this in the wasm spec.
      // Suppress closure compiler warning here. Closure compiler's builtin extern
      // definition for WebAssembly.RuntimeError claims it takes no arguments even
      // though it can.
      // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
      /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what)
      readyPromiseReject(e)
      // Throw the error whether or not MODULARIZE is set because abort is used
      // in code paths apart from instantiation where an exception is expected
      // to be thrown when abort is called.
      throw e
    }

    // include: memoryprofiler.js
    // end include: memoryprofiler.js
    // include: URIUtils.js
    // Prefix of data URIs emitted by SINGLE_FILE and related options.
    var dataURIPrefix = 'data:application/octet-stream;base64,'

    /**
     * Indicates whether filename is a base64 data URI.
     * @noinline
     */ var isDataURI = (filename) => filename.startsWith(dataURIPrefix)

    /**
     * Indicates whether filename is delivered via file protocol (as opposed to http/https)
     * @noinline
     */ var isFileURI = (filename) => filename.startsWith('file://')

    // end include: URIUtils.js
    // include: runtime_exceptions.js
    // end include: runtime_exceptions.js
    function findWasmBinary() {
      if (Module['locateFile']) {
        var f = 'zigfish.wasm'
        if (!isDataURI(f)) {
          return locateFile(f)
        }
        return f
      }
      // Use bundler-friendly `new URL(..., import.meta.url)` pattern; works in browsers too.
      return new URL('zigfish.wasm', import.meta.url).href
    }

    var wasmBinaryFile

    function getBinarySync(file) {
      if (file == wasmBinaryFile && wasmBinary) {
        return new Uint8Array(wasmBinary)
      }
      if (readBinary) {
        return readBinary(file)
      }
      throw 'both async and sync fetching of the wasm failed'
    }

    function getBinaryPromise(binaryFile) {
      // If we don't have the binary yet, load it asynchronously using readAsync.
      if (!wasmBinary) {
        // Fetch the binary using readAsync
        return readAsync(binaryFile).then(
          (response) => new Uint8Array(/** @type{!ArrayBuffer} */ (response)), // Fall back to getBinarySync if readAsync fails
          () => getBinarySync(binaryFile)
        )
      }
      // Otherwise, getBinarySync should be able to get it synchronously
      return Promise.resolve().then(() => getBinarySync(binaryFile))
    }

    var wasmOffsetConverter

    // include: wasm_offset_converter.js
    /** @constructor */ function WasmOffsetConverter(wasmBytes, wasmModule) {
      // This class parses a WASM binary file, and constructs a mapping from
      // function indices to the start of their code in the binary file, as well
      // as parsing the name section to allow conversion of offsets to function names.
      // The main purpose of this module is to enable the conversion of function
      // index and offset from start of function to an offset into the WASM binary.
      // This is needed to look up the WASM source map as well as generate
      // consistent program counter representations given v8's non-standard
      // WASM stack trace format.
      // v8 bug: https://crbug.com/v8/9172
      // This code is also used to check if the candidate source map offset is
      // actually part of the same function as the offset we are looking for,
      // as well as providing the function names for a given offset.
      // current byte offset into the WASM binary, as we parse it
      // the first section starts at offset 8.
      var offset = 8
      // the index of the next function we see in the binary
      var funcidx = 0
      // map from function index to byte offset in WASM binary
      this.offset_map = {}
      this.func_starts = []
      // map from function index to names in WASM binary
      this.name_map = {}
      // number of imported functions this module has
      this.import_functions = 0
      // the buffer unsignedLEB128 will read from.
      var buffer = wasmBytes
      function unsignedLEB128() {
        // consumes an unsigned LEB128 integer starting at `offset`.
        // changes `offset` to immediately after the integer
        var result = 0
        var shift = 0
        do {
          var byte = buffer[offset++]
          result += (byte & 127) << shift
          shift += 7
        } while (byte & 128)
        return result
      }
      function skipLimits() {
        var flags = unsignedLEB128()
        unsignedLEB128()
        // initial size
        var hasMax = (flags & 1) != 0
        if (hasMax) {
          unsignedLEB128()
        }
      }
      binary_parse: while (offset < buffer.length) {
        var type = buffer[offset++]
        var end = unsignedLEB128() + offset
        switch (type) {
          case 2:
            // import section
            // we need to find all function imports and increment funcidx for each one
            // since functions defined in the module are numbered after all imports
            var count = unsignedLEB128()
            while (count-- > 0) {
              // skip module
              offset = unsignedLEB128() + offset
              // skip name
              offset = unsignedLEB128() + offset
              var kind = buffer[offset++]
              switch (kind) {
                case 0:
                  // function import
                  ++funcidx
                  unsignedLEB128()
                  // skip function type
                  break

                case 1:
                  // table import
                  unsignedLEB128()
                  // skip elem type
                  skipLimits()
                  break

                case 2:
                  // memory import
                  skipLimits()
                  break

                case 3:
                  // global import
                  offset += 2
                  // skip type id byte and mutability byte
                  break

                case 4:
                  // tag import
                  ++offset
                  // skip attribute
                  unsignedLEB128()
                  // skip tag type
                  break
              }
            }
            this.import_functions = funcidx
            break

          case 10:
            // code section
            var count = unsignedLEB128()
            while (count-- > 0) {
              var size = unsignedLEB128()
              this.offset_map[funcidx++] = offset
              this.func_starts.push(offset)
              offset += size
            }
            break binary_parse
        }
        offset = end
      }
      var sections = WebAssembly.Module.customSections(wasmModule, 'name')
      var nameSection = sections.length ? sections[0] : undefined
      if (nameSection) {
        buffer = new Uint8Array(nameSection)
        offset = 0
        while (offset < buffer.length) {
          var subsection_type = buffer[offset++]
          var len = unsignedLEB128()
          // byte count
          if (subsection_type != 1) {
            // Skip the whole sub-section if it's not a function name sub-section.
            offset += len
            continue
          }
          var count = unsignedLEB128()
          while (count-- > 0) {
            var index = unsignedLEB128()
            var length = unsignedLEB128()
            this.name_map[index] = UTF8ArrayToString(buffer, offset, length)
            offset += length
          }
        }
      }
    }

    WasmOffsetConverter.prototype.convert = function (funcidx, offset) {
      return this.offset_map[funcidx] + offset
    }

    WasmOffsetConverter.prototype.getIndex = function (offset) {
      var lo = 0
      var hi = this.func_starts.length
      var mid
      while (lo < hi) {
        mid = Math.floor((lo + hi) / 2)
        if (this.func_starts[mid] > offset) {
          hi = mid
        } else {
          lo = mid + 1
        }
      }
      return lo + this.import_functions - 1
    }

    WasmOffsetConverter.prototype.isSameFunc = function (offset1, offset2) {
      return this.getIndex(offset1) == this.getIndex(offset2)
    }

    WasmOffsetConverter.prototype.getName = function (offset) {
      var index = this.getIndex(offset)
      return this.name_map[index] || 'wasm-function[' + index + ']'
    }

    // end include: wasm_offset_converter.js
    // When using postMessage to send an object, it is processed by the structured
    // clone algorithm.  The prototype, and hence methods, on that object is then
    // lost. This function adds back the lost prototype.  This does not work with
    // nested objects that has prototypes, but it suffices for WasmSourceMap and
    // WasmOffsetConverter.
    function resetPrototype(constructor, attrs) {
      var object = Object.create(constructor.prototype)
      return Object.assign(object, attrs)
    }

    function instantiateArrayBuffer(binaryFile, imports, receiver) {
      var savedBinary
      return getBinaryPromise(binaryFile)
        .then((binary) => {
          savedBinary = binary
          return WebAssembly.instantiate(binary, imports)
        })
        .then((instance) => {
          // wasmOffsetConverter needs to be assigned before calling the receiver
          // (receiveInstantiationResult).  See comments below in instantiateAsync.
          wasmOffsetConverter = new WasmOffsetConverter(savedBinary, instance.module)
          return instance
        })
        .then(receiver, (reason) => {
          err(`failed to asynchronously prepare wasm: ${reason}`)
          abort(reason)
        })
    }

    function instantiateAsync(binary, binaryFile, imports, callback) {
      if (
        !binary &&
        typeof WebAssembly.instantiateStreaming == 'function' &&
        !isDataURI(binaryFile) && // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
        !isFileURI(binaryFile) &&
        typeof fetch == 'function'
      ) {
        return fetch(binaryFile, {
          credentials: 'same-origin',
        }).then((response) => {
          // Suppress closure warning here since the upstream definition for
          // instantiateStreaming only allows Promise<Repsponse> rather than
          // an actual Response.
          // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure is fixed.
          /** @suppress {checkTypes} */ var result = WebAssembly.instantiateStreaming(
            response,
            imports
          )
          // We need the wasm binary for the offset converter. Clone the response
          // in order to get its arrayBuffer (cloning should be more efficient
          // than doing another entire request).
          // (We must clone the response now in order to use it later, as if we
          // try to clone it asynchronously lower down then we will get a
          // "response was already consumed" error.)
          var clonedResponsePromise = response.clone().arrayBuffer()
          return result.then(
            function (instantiationResult) {
              // When using the offset converter, we must interpose here. First,
              // the instantiation result must arrive (if it fails, the error
              // handling later down will handle it). Once it arrives, we can
              // initialize the offset converter. And only then is it valid to
              // call receiveInstantiationResult, as that function will use the
              // offset converter (in the case of pthreads, it will create the
              // pthreads and send them the offsets along with the wasm instance).
              clonedResponsePromise.then(
                (arrayBufferResult) => {
                  wasmOffsetConverter = new WasmOffsetConverter(
                    new Uint8Array(arrayBufferResult),
                    instantiationResult.module
                  )
                  callback(instantiationResult)
                },
                (reason) => err(`failed to initialize offset-converter: ${reason}`)
              )
            },
            function (reason) {
              // We expect the most common failure cause to be a bad MIME type for the binary,
              // in which case falling back to ArrayBuffer instantiation should work.
              err(`wasm streaming compile failed: ${reason}`)
              err('falling back to ArrayBuffer instantiation')
              return instantiateArrayBuffer(binaryFile, imports, callback)
            }
          )
        })
      }
      return instantiateArrayBuffer(binaryFile, imports, callback)
    }

    function getWasmImports() {
      assignWasmImports()
      // prepare imports
      return {
        a: wasmImports,
      }
    }

    // Create the wasm instance.
    // Receives the wasm imports, returns the exports.
    function createWasm() {
      var info = getWasmImports()
      // Load the wasm module and create an instance of using native support in the JS engine.
      // handle a generated wasm instance, receiving its exports and
      // performing other necessary setup
      /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
        wasmExports = instance.exports
        wasmExports = Asyncify.instrumentWasmExports(wasmExports)
        registerTLSInit(wasmExports['ze'])
        addOnInit(wasmExports['se'])
        // We now have the Wasm module loaded up, keep a reference to the compiled module so we can post it to the workers.
        wasmModule = module
        removeRunDependency('wasm-instantiate')
        return wasmExports
      }
      // wait for the pthread pool (if any)
      addRunDependency('wasm-instantiate')
      // Prefer streaming instantiation if available.
      function receiveInstantiationResult(result) {
        // 'result' is a ResultObject object which has both the module and instance.
        // receiveInstance() will swap in the exports (to Module.asm) so they can be called
        receiveInstance(result['instance'], result['module'])
      }
      // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
      // to manually instantiate the Wasm module themselves. This allows pages to
      // run the instantiation parallel to any other async startup actions they are
      // performing.
      // Also pthreads and wasm workers initialize the wasm instance through this
      // path.
      if (Module['instantiateWasm']) {
        try {
          return Module['instantiateWasm'](info, receiveInstance)
        } catch (e) {
          err(`Module.instantiateWasm callback failed with error: ${e}`)
          // If instantiation fails, reject the module ready promise.
          readyPromiseReject(e)
        }
      }
      if (!wasmBinaryFile) wasmBinaryFile = findWasmBinary()
      // If instantiation fails, reject the module ready promise.
      instantiateAsync(wasmBinary, wasmBinaryFile, info, receiveInstantiationResult).catch(
        readyPromiseReject
      )
      return {}
    }

    // Globals used by JS i64 conversions (see makeSetValue)
    var tempDouble

    var tempI64

    // include: runtime_debug.js
    // end include: runtime_debug.js
    // === Body ===
    var ASM_CONSTS = {
      332224: () => {
        if (document.fullscreenElement) return 1
      },
      332270: () => document.getElementById('canvas').width,
      332322: () => parseInt(document.getElementById('canvas').style.width),
      332390: () => {
        document.exitFullscreen()
      },
      332417: () => {
        setTimeout(function () {
          Module.requestFullscreen(false, false)
        }, 100)
      },
      332490: () => {
        if (document.fullscreenElement) return 1
      },
      332536: () => document.getElementById('canvas').width,
      332588: () => screen.width,
      332613: () => {
        document.exitFullscreen()
      },
      332640: () => {
        setTimeout(function () {
          Module.requestFullscreen(false, true)
          setTimeout(function () {
            canvas.style.width = 'unset'
          }, 100)
        }, 100)
      },
      332773: () => {
        if (document.fullscreenElement) return 1
      },
      332819: () => document.getElementById('canvas').width,
      332871: () => parseInt(document.getElementById('canvas').style.width),
      332939: () => {
        if (document.fullscreenElement) return 1
      },
      332985: () => document.getElementById('canvas').width,
      333037: () => screen.width,
      333062: () => {
        if (document.fullscreenElement) return 1
      },
      333108: () => document.getElementById('canvas').width,
      333160: () => screen.width,
      333185: () => {
        document.exitFullscreen()
      },
      333212: () => {
        if (document.fullscreenElement) return 1
      },
      333258: () => document.getElementById('canvas').width,
      333310: () => parseInt(document.getElementById('canvas').style.width),
      333378: () => {
        document.exitFullscreen()
      },
      333405: () => screen.width,
      333430: () => screen.height,
      333456: () => window.screenX,
      333483: () => window.screenY,
      333510: ($0) => {
        navigator.clipboard.writeText(UTF8ToString($0))
      },
      333563: ($0) => {
        document.getElementById('canvas').style.cursor = UTF8ToString($0)
      },
      333634: () => {
        document.getElementById('canvas').style.cursor = 'none'
      },
      333691: ($0) => {
        document.getElementById('canvas').style.cursor = UTF8ToString($0)
      },
      333762: () => {
        if (document.fullscreenElement) return 1
      },
      333808: () => {
        if (document.pointerLockElement) return 1
      },
      333855: ($0, $1, $2, $3, $4) => {
        if (
          typeof window === 'undefined' ||
          (window.AudioContext || window.webkitAudioContext) === undefined
        ) {
          return 0
        }
        if (typeof window.miniaudio === 'undefined') {
          window.miniaudio = {
            referenceCount: 0,
          }
          window.miniaudio.device_type = {}
          window.miniaudio.device_type.playback = $0
          window.miniaudio.device_type.capture = $1
          window.miniaudio.device_type.duplex = $2
          window.miniaudio.device_state = {}
          window.miniaudio.device_state.stopped = $3
          window.miniaudio.device_state.started = $4
          miniaudio.devices = []
          miniaudio.track_device = function (device) {
            for (var iDevice = 0; iDevice < miniaudio.devices.length; ++iDevice) {
              if (miniaudio.devices[iDevice] == null) {
                miniaudio.devices[iDevice] = device
                return iDevice
              }
            }
            miniaudio.devices.push(device)
            return miniaudio.devices.length - 1
          }
          miniaudio.untrack_device_by_index = function (deviceIndex) {
            miniaudio.devices[deviceIndex] = null
            while (miniaudio.devices.length > 0) {
              if (miniaudio.devices[miniaudio.devices.length - 1] == null) {
                miniaudio.devices.pop()
              } else {
                break
              }
            }
          }
          miniaudio.untrack_device = function (device) {
            for (var iDevice = 0; iDevice < miniaudio.devices.length; ++iDevice) {
              if (miniaudio.devices[iDevice] == device) {
                return miniaudio.untrack_device_by_index(iDevice)
              }
            }
          }
          miniaudio.get_device_by_index = function (deviceIndex) {
            return miniaudio.devices[deviceIndex]
          }
          miniaudio.unlock_event_types = (function () {
            return ['touchend', 'click']
          })()
          miniaudio.unlock = function () {
            for (var i = 0; i < miniaudio.devices.length; ++i) {
              var device = miniaudio.devices[i]
              if (
                device != null &&
                device.webaudio != null &&
                device.state === window.miniaudio.device_state.started
              ) {
                device.webaudio.resume().then(
                  () => {
                    Module._ma_device__on_notification_unlocked(device.pDevice)
                  },
                  (error) => {
                    console.error('Failed to resume audiocontext', error)
                  }
                )
              }
            }
            miniaudio.unlock_event_types.map(function (event_type) {
              document.removeEventListener(event_type, miniaudio.unlock, true)
            })
          }
          miniaudio.unlock_event_types.map(function (event_type) {
            document.addEventListener(event_type, miniaudio.unlock, true)
          })
        }
        window.miniaudio.referenceCount += 1
        return 1
      },
      336013: () => {
        if (typeof window.miniaudio !== 'undefined') {
          window.miniaudio.referenceCount -= 1
          if (window.miniaudio.referenceCount === 0) {
            delete window.miniaudio
          }
        }
      },
      336177: () =>
        navigator.mediaDevices !== undefined && navigator.mediaDevices.getUserMedia !== undefined,
      336281: () => {
        try {
          var temp = new (window.AudioContext || window.webkitAudioContext)()
          var sampleRate = temp.sampleRate
          temp.close()
          return sampleRate
        } catch (e) {
          return 0
        }
      },
      336452: ($0, $1, $2, $3, $4, $5) => {
        var deviceType = $0
        var channels = $1
        var sampleRate = $2
        var bufferSize = $3
        var pIntermediaryBuffer = $4
        var pDevice = $5
        if (typeof window.miniaudio === 'undefined') {
          return -1
        }
        var device = {}
        var audioContextOptions = {}
        if (deviceType == window.miniaudio.device_type.playback && sampleRate != 0) {
          audioContextOptions.sampleRate = sampleRate
        }
        device.webaudio = new (window.AudioContext || window.webkitAudioContext)(
          audioContextOptions
        )
        device.webaudio.suspend()
        device.state = window.miniaudio.device_state.stopped
        var channelCountIn = 0
        var channelCountOut = channels
        if (deviceType != window.miniaudio.device_type.playback) {
          channelCountIn = channels
        }
        device.scriptNode = device.webaudio.createScriptProcessor(
          bufferSize,
          channelCountIn,
          channelCountOut
        )
        device.scriptNode.onaudioprocess = function (e) {
          if (device.intermediaryBufferView == null || device.intermediaryBufferView.length == 0) {
            device.intermediaryBufferView = new Float32Array(
              Module.HEAPF32.buffer,
              pIntermediaryBuffer,
              bufferSize * channels
            )
          }
          if (
            deviceType == miniaudio.device_type.capture ||
            deviceType == miniaudio.device_type.duplex
          ) {
            for (var iChannel = 0; iChannel < channels; iChannel += 1) {
              var inputBuffer = e.inputBuffer.getChannelData(iChannel)
              var intermediaryBuffer = device.intermediaryBufferView
              for (var iFrame = 0; iFrame < bufferSize; iFrame += 1) {
                intermediaryBuffer[iFrame * channels + iChannel] = inputBuffer[iFrame]
              }
            }
            _ma_device_process_pcm_frames_capture__webaudio(
              pDevice,
              bufferSize,
              pIntermediaryBuffer
            )
          }
          if (
            deviceType == miniaudio.device_type.playback ||
            deviceType == miniaudio.device_type.duplex
          ) {
            _ma_device_process_pcm_frames_playback__webaudio(
              pDevice,
              bufferSize,
              pIntermediaryBuffer
            )
            for (var iChannel = 0; iChannel < e.outputBuffer.numberOfChannels; ++iChannel) {
              var outputBuffer = e.outputBuffer.getChannelData(iChannel)
              var intermediaryBuffer = device.intermediaryBufferView
              for (var iFrame = 0; iFrame < bufferSize; iFrame += 1) {
                outputBuffer[iFrame] = intermediaryBuffer[iFrame * channels + iChannel]
              }
            }
          } else {
            for (var iChannel = 0; iChannel < e.outputBuffer.numberOfChannels; ++iChannel) {
              e.outputBuffer.getChannelData(iChannel).fill(0)
            }
          }
        }
        if (
          deviceType == miniaudio.device_type.capture ||
          deviceType == miniaudio.device_type.duplex
        ) {
          navigator.mediaDevices
            .getUserMedia({
              audio: true,
              video: false,
            })
            .then(function (stream) {
              device.streamNode = device.webaudio.createMediaStreamSource(stream)
              device.streamNode.connect(device.scriptNode)
              device.scriptNode.connect(device.webaudio.destination)
            })
            .catch(function (error) {
              console.log('Failed to get user media: ' + error)
            })
        }
        if (deviceType == miniaudio.device_type.playback) {
          device.scriptNode.connect(device.webaudio.destination)
        }
        device.pDevice = pDevice
        return miniaudio.track_device(device)
      },
      339280: ($0) => miniaudio.get_device_by_index($0).webaudio.sampleRate,
      339346: ($0) => {
        var device = miniaudio.get_device_by_index($0)
        if (device.scriptNode !== undefined) {
          device.scriptNode.onaudioprocess = function (e) {}
          device.scriptNode.disconnect()
          device.scriptNode = undefined
        }
        if (device.streamNode !== undefined) {
          device.streamNode.disconnect()
          device.streamNode = undefined
        }
        device.webaudio.close()
        device.webaudio = undefined
        device.pDevice = undefined
      },
      339739: ($0) => {
        miniaudio.untrack_device_by_index($0)
      },
      339782: ($0) => {
        var device = miniaudio.get_device_by_index($0)
        device.webaudio.resume()
        device.state = miniaudio.device_state.started
      },
      339907: ($0) => {
        var device = miniaudio.get_device_by_index($0)
        device.webaudio.suspend()
        device.state = miniaudio.device_state.stopped
      },
    }

    function GetWindowInnerWidth() {
      return window.innerWidth
    }

    function GetWindowInnerHeight() {
      return window.innerHeight
    }

    // end include: preamble.js
    /** @constructor */ function ExitStatus(status) {
      this.name = 'ExitStatus'
      this.message = `Program terminated with exit(${status})`
      this.status = status
    }

    var terminateWorker = (worker) => {
      worker.terminate()
      // terminate() can be asynchronous, so in theory the worker can continue
      // to run for some amount of time after termination.  However from our POV
      // the worker now dead and we don't want to hear from it again, so we stub
      // out its message handler here.  This avoids having to check in each of
      // the onmessage handlers if the message was coming from valid worker.
      worker.onmessage = (e) => {}
    }

    var killThread = (pthread_ptr) => {
      var worker = PThread.pthreads[pthread_ptr]
      delete PThread.pthreads[pthread_ptr]
      terminateWorker(worker)
      __emscripten_thread_free_data(pthread_ptr)
      // The worker was completely nuked (not just the pthread execution it was hosting), so remove it from running workers
      // but don't put it back to the pool.
      PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1)
      // Not a running Worker anymore.
      worker.pthread_ptr = 0
    }

    var cancelThread = (pthread_ptr) => {
      var worker = PThread.pthreads[pthread_ptr]
      worker.postMessage({
        cmd: 'cancel',
      })
    }

    var cleanupThread = (pthread_ptr) => {
      var worker = PThread.pthreads[pthread_ptr]
      PThread.returnWorkerToPool(worker)
    }

    var spawnThread = (threadParams) => {
      var worker = PThread.getNewWorker()
      if (!worker) {
        // No available workers in the PThread pool.
        return 6
      }
      PThread.runningWorkers.push(worker)
      // Add to pthreads map
      PThread.pthreads[threadParams.pthread_ptr] = worker
      worker.pthread_ptr = threadParams.pthread_ptr
      var msg = {
        cmd: 'run',
        start_routine: threadParams.startRoutine,
        arg: threadParams.arg,
        pthread_ptr: threadParams.pthread_ptr,
      }
      // Ask the worker to start executing its pthread entry point function.
      worker.postMessage(msg, threadParams.transferList)
      return 0
    }

    var runtimeKeepaliveCounter = 0

    var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0

    var stackSave = () => _emscripten_stack_get_current()

    var stackRestore = (val) => __emscripten_stack_restore(val)

    var stackAlloc = (sz) => __emscripten_stack_alloc(sz)

    var convertI32PairToI53Checked = (lo, hi) =>
      (hi + 2097152) >>> 0 < 4194305 - !!lo ? (lo >>> 0) + hi * 4294967296 : NaN

    /** @type{function(number, (number|boolean), ...number)} */ var proxyToMainThread = (
      funcIndex,
      emAsmAddr,
      sync,
      ...callArgs
    ) => {
      // EM_ASM proxying is done by passing a pointer to the address of the EM_ASM
      // content as `emAsmAddr`.  JS library proxying is done by passing an index
      // into `proxiedJSCallArgs` as `funcIndex`. If `emAsmAddr` is non-zero then
      // `funcIndex` will be ignored.
      // Additional arguments are passed after the first three are the actual
      // function arguments.
      // The serialization buffer contains the number of call params, and then
      // all the args here.
      // We also pass 'sync' to C separately, since C needs to look at it.
      // Allocate a buffer, which will be copied by the C code.
      // First passed parameter specifies the number of arguments to the function.
      // When BigInt support is enabled, we must handle types in a more complex
      // way, detecting at runtime if a value is a BigInt or not (as we have no
      // type info here). To do that, add a "prefix" before each value that
      // indicates if it is a BigInt, which effectively doubles the number of
      // values we serialize for proxying. TODO: pack this?
      var serializedNumCallArgs = callArgs.length
      var sp = stackSave()
      var args = stackAlloc(serializedNumCallArgs * 8)
      var b = args >> 3
      for (var i = 0; i < callArgs.length; i++) {
        var arg = callArgs[i]
        GROWABLE_HEAP_F64()[b + i] = arg
      }
      var rtn = __emscripten_run_on_main_thread_js(
        funcIndex,
        emAsmAddr,
        serializedNumCallArgs,
        args,
        sync
      )
      stackRestore(sp)
      return rtn
    }

    function _proc_exit(code) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(0, 0, 1, code)
      EXITSTATUS = code
      if (!keepRuntimeAlive()) {
        PThread.terminateAllThreads()
        Module['onExit']?.(code)
        ABORT = true
      }
      quit_(code, new ExitStatus(code))
    }

    var handleException = (e) => {
      // Certain exception types we do not treat as errors since they are used for
      // internal control flow.
      // 1. ExitStatus, which is thrown by exit()
      // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
      //    that wish to return to JS event loop.
      if (e instanceof ExitStatus || e == 'unwind') {
        return EXITSTATUS
      }
      quit_(1, e)
    }

    function exitOnMainThread(returnCode) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(1, 0, 0, returnCode)
      _exit(returnCode)
    }

    /** @suppress {duplicate } */ /** @param {boolean|number=} implicit */ var exitJS = (
      status,
      implicit
    ) => {
      EXITSTATUS = status
      if (ENVIRONMENT_IS_PTHREAD) {
        // implicit exit can never happen on a pthread
        // When running in a pthread we propagate the exit back to the main thread
        // where it can decide if the whole process should be shut down or not.
        // The pthread may have decided not to exit its own runtime, for example
        // because it runs a main loop, but that doesn't affect the main thread.
        exitOnMainThread(status)
        throw 'unwind'
      }
      if (!keepRuntimeAlive()) {
        exitRuntime()
      }
      _proc_exit(status)
    }

    var _exit = exitJS

    var PThread = {
      unusedWorkers: [],
      runningWorkers: [],
      tlsInitFunctions: [],
      pthreads: {},
      init() {
        if (ENVIRONMENT_IS_PTHREAD) {
          PThread.initWorker()
        } else {
          PThread.initMainThread()
        }
      },
      initMainThread() {
        var pthreadPoolSize = 2
        // Start loading up the Worker pool, if requested.
        while (pthreadPoolSize--) {
          PThread.allocateUnusedWorker()
        }
        // MINIMAL_RUNTIME takes care of calling loadWasmModuleToAllWorkers
        // in postamble_minimal.js
        addOnPreRun(() => {
          addRunDependency('loading-workers')
          PThread.loadWasmModuleToAllWorkers(() => removeRunDependency('loading-workers'))
        })
      },
      initWorker() {
        // The default behaviour for pthreads is always to exit once they return
        // from their entry point (or call pthread_exit).  If we set noExitRuntime
        // to true here on pthreads they would never complete and attempt to
        // pthread_join to them would block forever.
        // pthreads can still choose to set `noExitRuntime` explicitly, or
        // call emscripten_unwind_to_js_event_loop to extend their lifetime beyond
        // their main function.  See comment in src/runtime_pthread.js for more.
        noExitRuntime = false
      },
      setExitStatus: (status) => (EXITSTATUS = status),
      terminateAllThreads__deps: ['$terminateWorker'],
      terminateAllThreads: () => {
        // Attempt to kill all workers.  Sadly (at least on the web) there is no
        // way to terminate a worker synchronously, or to be notified when a
        // worker in actually terminated.  This means there is some risk that
        // pthreads will continue to be executing after `worker.terminate` has
        // returned.  For this reason, we don't call `returnWorkerToPool` here or
        // free the underlying pthread data structures.
        for (var worker of PThread.runningWorkers) {
          terminateWorker(worker)
        }
        for (var worker of PThread.unusedWorkers) {
          terminateWorker(worker)
        }
        PThread.unusedWorkers = []
        PThread.runningWorkers = []
        PThread.pthreads = []
      },
      returnWorkerToPool: (worker) => {
        // We don't want to run main thread queued calls here, since we are doing
        // some operations that leave the worker queue in an invalid state until
        // we are completely done (it would be bad if free() ends up calling a
        // queued pthread_create which looks at the global data structures we are
        // modifying). To achieve that, defer the free() til the very end, when
        // we are all done.
        var pthread_ptr = worker.pthread_ptr
        delete PThread.pthreads[pthread_ptr]
        // Note: worker is intentionally not terminated so the pool can
        // dynamically grow.
        PThread.unusedWorkers.push(worker)
        PThread.runningWorkers.splice(PThread.runningWorkers.indexOf(worker), 1)
        // Not a running Worker anymore
        // Detach the worker from the pthread object, and return it to the
        // worker pool as an unused worker.
        worker.pthread_ptr = 0
        // Finally, free the underlying (and now-unused) pthread structure in
        // linear memory.
        __emscripten_thread_free_data(pthread_ptr)
      },
      receiveObjectTransfer(data) {},
      threadInitTLS() {
        // Call thread init functions (these are the _emscripten_tls_init for each
        // module loaded.
        PThread.tlsInitFunctions.forEach((f) => f())
      },
      loadWasmModuleToWorker: (worker) =>
        new Promise((onFinishedLoading) => {
          worker.onmessage = (e) => {
            var d = e['data']
            var cmd = d['cmd']
            // If this message is intended to a recipient that is not the main
            // thread, forward it to the target thread.
            if (d['targetThread'] && d['targetThread'] != _pthread_self()) {
              var targetWorker = PThread.pthreads[d['targetThread']]
              if (targetWorker) {
                targetWorker.postMessage(d, d['transferList'])
              } else {
                err(
                  `Internal error! Worker sent a message "${cmd}" to target pthread ${d['targetThread']}, but that thread no longer exists!`
                )
              }
              return
            }
            if (cmd === 'checkMailbox') {
              checkMailbox()
            } else if (cmd === 'spawnThread') {
              spawnThread(d)
            } else if (cmd === 'cleanupThread') {
              cleanupThread(d['thread'])
            } else if (cmd === 'killThread') {
              killThread(d['thread'])
            } else if (cmd === 'cancelThread') {
              cancelThread(d['thread'])
            } else if (cmd === 'loaded') {
              worker.loaded = true
              onFinishedLoading(worker)
            } else if (cmd === 'alert') {
              alert(`Thread ${d['threadId']}: ${d['text']}`)
            } else if (d.target === 'setimmediate') {
              // Worker wants to postMessage() to itself to implement setImmediate()
              // emulation.
              worker.postMessage(d)
            } else if (cmd === 'callHandler') {
              Module[d['handler']](...d['args'])
            } else if (cmd) {
              // The received message looks like something that should be handled by this message
              // handler, (since there is a e.data.cmd field present), but is not one of the
              // recognized commands:
              err(`worker sent an unknown command ${cmd}`)
            }
          }
          worker.onerror = (e) => {
            var message = 'worker sent an error!'
            err(`${message} ${e.filename}:${e.lineno}: ${e.message}`)
            throw e
          }
          // When running on a pthread, none of the incoming parameters on the module
          // object are present. Proxy known handlers back to the main thread if specified.
          var handlers = []
          var knownHandlers = ['onExit', 'onAbort', 'print', 'printErr']
          for (var handler of knownHandlers) {
            if (Module.propertyIsEnumerable(handler)) {
              handlers.push(handler)
            }
          }
          // Ask the new worker to load up the Emscripten-compiled page. This is a heavy operation.
          worker.postMessage({
            cmd: 'load',
            handlers: handlers,
            wasmMemory: wasmMemory,
            wasmModule: wasmModule,
            wasmOffsetConverter: wasmOffsetConverter,
          })
        }),
      loadWasmModuleToAllWorkers(onMaybeReady) {
        // Instantiation is synchronous in pthreads.
        if (ENVIRONMENT_IS_PTHREAD) {
          return onMaybeReady()
        }
        let pthreadPoolReady = Promise.all(
          PThread.unusedWorkers.map(PThread.loadWasmModuleToWorker)
        )
        pthreadPoolReady.then(onMaybeReady)
      },
      allocateUnusedWorker() {
        var worker
        var workerOptions = {
          type: 'module',
          // This is the way that we signal to the Web Worker that it is hosting
          // a pthread.
          name: 'em-pthread',
        }
        // If we're using module output, use bundler-friendly pattern.
        console.log('URL!!@#!@!@#', new URL(import.meta.url))
        worker = new Worker(new URL(import.meta.url), workerOptions)
        PThread.unusedWorkers.push(worker)
      },
      getNewWorker() {
        if (PThread.unusedWorkers.length == 0) {
          // PTHREAD_POOL_SIZE_STRICT should show a warning and, if set to level `2`, return from the function.
          PThread.allocateUnusedWorker()
          PThread.loadWasmModuleToWorker(PThread.unusedWorkers[0])
        }
        return PThread.unusedWorkers.pop()
      },
    }

    var UTF8Decoder = typeof TextDecoder != 'undefined' ? new TextDecoder() : undefined

    /**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx, maxBytesToRead) => {
      var endIdx = idx + maxBytesToRead
      var endPtr = idx
      // TextDecoder needs to know the byte length in advance, it doesn't stop on
      // null terminator by itself.  Also, use the length info to avoid running tiny
      // strings through TextDecoder, since .subarray() allocates garbage.
      // (As a tiny code save trick, compare endPtr against endIdx using a negation,
      // so that undefined means Infinity)
      while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr
      if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
        return UTF8Decoder.decode(
          heapOrArray.buffer instanceof SharedArrayBuffer
            ? heapOrArray.slice(idx, endPtr)
            : heapOrArray.subarray(idx, endPtr)
        )
      }
      var str = ''
      // If building with TextDecoder, we have already computed the string length
      // above, so test loop end condition against that
      while (idx < endPtr) {
        // For UTF8 byte structure, see:
        // http://en.wikipedia.org/wiki/UTF-8#Description
        // https://www.ietf.org/rfc/rfc2279.txt
        // https://tools.ietf.org/html/rfc3629
        var u0 = heapOrArray[idx++]
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0)
          continue
        }
        var u1 = heapOrArray[idx++] & 63
        if ((u0 & 224) == 192) {
          str += String.fromCharCode(((u0 & 31) << 6) | u1)
          continue
        }
        var u2 = heapOrArray[idx++] & 63
        if ((u0 & 240) == 224) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2
        } else {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63)
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0)
        } else {
          var ch = u0 - 65536
          str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023))
        }
      }
      return str
    }

    var callRuntimeCallbacks = (callbacks) => {
      while (callbacks.length > 0) {
        // Pass the module as the first argument.
        callbacks.shift()(Module)
      }
    }

    var establishStackSpace = () => {
      var pthread_ptr = _pthread_self()
      var stackHigh = GROWABLE_HEAP_U32()[(pthread_ptr + 52) >> 2]
      var stackSize = GROWABLE_HEAP_U32()[(pthread_ptr + 56) >> 2]
      var stackLow = stackHigh - stackSize
      // Set stack limits used by `emscripten/stack.h` function.  These limits are
      // cached in wasm-side globals to make checks as fast as possible.
      _emscripten_stack_set_limits(stackHigh, stackLow)
      // Call inside wasm module to set up the stack frame for this pthread in wasm module scope
      stackRestore(stackHigh)
    }

    var invokeEntryPoint = (ptr, arg) => {
      // An old thread on this worker may have been canceled without returning the
      // `runtimeKeepaliveCounter` to zero. Reset it now so the new thread won't
      // be affected.
      runtimeKeepaliveCounter = 0
      // pthread entry points are always of signature 'void *ThreadMain(void *arg)'
      // Native codebases sometimes spawn threads with other thread entry point
      // signatures, such as void ThreadMain(void *arg), void *ThreadMain(), or
      // void ThreadMain().  That is not acceptable per C/C++ specification, but
      // x86 compiler ABI extensions enable that to work. If you find the
      // following line to crash, either change the signature to "proper" void
      // *ThreadMain(void *arg) form, or try linking with the Emscripten linker
      // flag -sEMULATE_FUNCTION_POINTER_CASTS to add in emulation for this x86
      // ABI extension.
      var result = ((a1) => dynCall_ii(ptr, a1))(arg)
      function finish(result) {
        if (keepRuntimeAlive()) {
          PThread.setExitStatus(result)
        } else {
          __emscripten_thread_exit(result)
        }
      }
      finish(result)
    }

    var noExitRuntime = Module['noExitRuntime'] || false

    var registerTLSInit = (tlsInitFunc) => PThread.tlsInitFunctions.push(tlsInitFunc)

    /**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) =>
      ptr ? UTF8ArrayToString(GROWABLE_HEAP_U8(), ptr, maxBytesToRead) : ''

    var ___assert_fail = (condition, filename, line, func) => {
      abort(
        `Assertion failed: ${UTF8ToString(condition)}, at: ` +
          [
            filename ? UTF8ToString(filename) : 'unknown filename',
            line,
            func ? UTF8ToString(func) : 'unknown function',
          ]
      )
    }

    function pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(2, 0, 1, pthread_ptr, attr, startRoutine, arg)
      return ___pthread_create_js(pthread_ptr, attr, startRoutine, arg)
    }

    var ___pthread_create_js = (pthread_ptr, attr, startRoutine, arg) => {
      if (typeof SharedArrayBuffer == 'undefined') {
        err('Current environment does not support SharedArrayBuffer, pthreads are not available!')
        return 6
      }
      // List of JS objects that will transfer ownership to the Worker hosting the thread
      var transferList = []
      var error = 0
      // Synchronously proxy the thread creation to main thread if possible. If we
      // need to transfer ownership of objects, then proxy asynchronously via
      // postMessage.
      if (ENVIRONMENT_IS_PTHREAD && (transferList.length === 0 || error)) {
        return pthreadCreateProxied(pthread_ptr, attr, startRoutine, arg)
      }
      // If on the main thread, and accessing Canvas/OffscreenCanvas failed, abort
      // with the detected error.
      if (error) return error
      var threadParams = {
        startRoutine: startRoutine,
        pthread_ptr: pthread_ptr,
        arg: arg,
        transferList: transferList,
      }
      if (ENVIRONMENT_IS_PTHREAD) {
        // The prepopulated pool of web workers that can host pthreads is stored
        // in the main JS thread. Therefore if a pthread is attempting to spawn a
        // new thread, the thread creation must be deferred to the main JS thread.
        threadParams.cmd = 'spawnThread'
        postMessage(threadParams, transferList)
        // When we defer thread creation this way, we have no way to detect thread
        // creation synchronously today, so we have to assume success and return 0.
        return 0
      }
      // We are the main thread, so we have the pthread warmup pool in this
      // thread and can fire off JS thread creation directly ourselves.
      return spawnThread(threadParams)
    }

    var PATH = {
      isAbs: (path) => path.charAt(0) === '/',
      splitPath: (filename) => {
        var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
        return splitPathRe.exec(filename).slice(1)
      },
      normalizeArray: (parts, allowAboveRoot) => {
        // if the path tries to go above the root, `up` ends up > 0
        var up = 0
        for (var i = parts.length - 1; i >= 0; i--) {
          var last = parts[i]
          if (last === '.') {
            parts.splice(i, 1)
          } else if (last === '..') {
            parts.splice(i, 1)
            up++
          } else if (up) {
            parts.splice(i, 1)
            up--
          }
        }
        // if the path is allowed to go above the root, restore leading ..s
        if (allowAboveRoot) {
          for (; up; up--) {
            parts.unshift('..')
          }
        }
        return parts
      },
      normalize: (path) => {
        var isAbsolute = PATH.isAbs(path),
          trailingSlash = path.substr(-1) === '/'
        // Normalize the path
        path = PATH.normalizeArray(
          path.split('/').filter((p) => !!p),
          !isAbsolute
        ).join('/')
        if (!path && !isAbsolute) {
          path = '.'
        }
        if (path && trailingSlash) {
          path += '/'
        }
        return (isAbsolute ? '/' : '') + path
      },
      dirname: (path) => {
        var result = PATH.splitPath(path),
          root = result[0],
          dir = result[1]
        if (!root && !dir) {
          // No dirname whatsoever
          return '.'
        }
        if (dir) {
          // It has a dirname, strip trailing slash
          dir = dir.substr(0, dir.length - 1)
        }
        return root + dir
      },
      basename: (path) => {
        // EMSCRIPTEN return '/'' for '/', not an empty string
        if (path === '/') return '/'
        path = PATH.normalize(path)
        path = path.replace(/\/$/, '')
        var lastSlash = path.lastIndexOf('/')
        if (lastSlash === -1) return path
        return path.substr(lastSlash + 1)
      },
      join: (...paths) => PATH.normalize(paths.join('/')),
      join2: (l, r) => PATH.normalize(l + '/' + r),
    }

    var initRandomFill = () => {
      if (typeof crypto == 'object' && typeof crypto['getRandomValues'] == 'function') {
        // for modern web browsers
        // like with most Web APIs, we can't use Web Crypto API directly on shared memory,
        // so we need to create an intermediate buffer and copy it to the destination
        return (view) => (
          view.set(crypto.getRandomValues(new Uint8Array(view.byteLength))),
          // Return the original view to match modern native implementations.
          view
        )
      } // we couldn't find a proper implementation, as Math.random() is not suitable for /dev/random, see emscripten-core/emscripten/pull/7096
      else abort('initRandomDevice')
    }

    var randomFill = (view) => (randomFill = initRandomFill())(view)

    var PATH_FS = {
      resolve: (...args) => {
        var resolvedPath = '',
          resolvedAbsolute = false
        for (var i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
          var path = i >= 0 ? args[i] : FS.cwd()
          // Skip empty and invalid entries
          if (typeof path != 'string') {
            throw new TypeError('Arguments to path.resolve must be strings')
          } else if (!path) {
            return ''
          }
          // an invalid portion invalidates the whole thing
          resolvedPath = path + '/' + resolvedPath
          resolvedAbsolute = PATH.isAbs(path)
        }
        // At this point the path should be resolved to a full absolute path, but
        // handle relative paths to be safe (might happen when process.cwd() fails)
        resolvedPath = PATH.normalizeArray(
          resolvedPath.split('/').filter((p) => !!p),
          !resolvedAbsolute
        ).join('/')
        return (resolvedAbsolute ? '/' : '') + resolvedPath || '.'
      },
      relative: (from, to) => {
        from = PATH_FS.resolve(from).substr(1)
        to = PATH_FS.resolve(to).substr(1)
        function trim(arr) {
          var start = 0
          for (; start < arr.length; start++) {
            if (arr[start] !== '') break
          }
          var end = arr.length - 1
          for (; end >= 0; end--) {
            if (arr[end] !== '') break
          }
          if (start > end) return []
          return arr.slice(start, end - start + 1)
        }
        var fromParts = trim(from.split('/'))
        var toParts = trim(to.split('/'))
        var length = Math.min(fromParts.length, toParts.length)
        var samePartsLength = length
        for (var i = 0; i < length; i++) {
          if (fromParts[i] !== toParts[i]) {
            samePartsLength = i
            break
          }
        }
        var outputParts = []
        for (var i = samePartsLength; i < fromParts.length; i++) {
          outputParts.push('..')
        }
        outputParts = outputParts.concat(toParts.slice(samePartsLength))
        return outputParts.join('/')
      },
    }

    var FS_stdin_getChar_buffer = []

    var lengthBytesUTF8 = (str) => {
      var len = 0
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var c = str.charCodeAt(i)
        // possibly a lead surrogate
        if (c <= 127) {
          len++
        } else if (c <= 2047) {
          len += 2
        } else if (c >= 55296 && c <= 57343) {
          len += 4
          ++i
        } else {
          len += 3
        }
      }
      return len
    }

    var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
      // Parameter maxBytesToWrite is not optional. Negative values, 0, null,
      // undefined and false each don't write out any bytes.
      if (!(maxBytesToWrite > 0)) return 0
      var startIdx = outIdx
      var endIdx = outIdx + maxBytesToWrite - 1
      // -1 for string null terminator.
      for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code
        // unit, not a Unicode code point of the character! So decode
        // UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description
        // and https://www.ietf.org/rfc/rfc2279.txt
        // and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i)
        // possibly a lead surrogate
        if (u >= 55296 && u <= 57343) {
          var u1 = str.charCodeAt(++i)
          u = (65536 + ((u & 1023) << 10)) | (u1 & 1023)
        }
        if (u <= 127) {
          if (outIdx >= endIdx) break
          heap[outIdx++] = u
        } else if (u <= 2047) {
          if (outIdx + 1 >= endIdx) break
          heap[outIdx++] = 192 | (u >> 6)
          heap[outIdx++] = 128 | (u & 63)
        } else if (u <= 65535) {
          if (outIdx + 2 >= endIdx) break
          heap[outIdx++] = 224 | (u >> 12)
          heap[outIdx++] = 128 | ((u >> 6) & 63)
          heap[outIdx++] = 128 | (u & 63)
        } else {
          if (outIdx + 3 >= endIdx) break
          heap[outIdx++] = 240 | (u >> 18)
          heap[outIdx++] = 128 | ((u >> 12) & 63)
          heap[outIdx++] = 128 | ((u >> 6) & 63)
          heap[outIdx++] = 128 | (u & 63)
        }
      }
      // Null-terminate the pointer to the buffer.
      heap[outIdx] = 0
      return outIdx - startIdx
    }

    /** @type {function(string, boolean=, number=)} */ function intArrayFromString(
      stringy,
      dontAddNull,
      length
    ) {
      var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1
      var u8array = new Array(len)
      var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length)
      if (dontAddNull) u8array.length = numBytesWritten
      return u8array
    }

    var FS_stdin_getChar = () => {
      if (!FS_stdin_getChar_buffer.length) {
        var result = null
        if (typeof window != 'undefined' && typeof window.prompt == 'function') {
          // Browser.
          result = window.prompt('Input: ')
          // returns null on cancel
          if (result !== null) {
            result += '\n'
          }
        } else {
        }
        if (!result) {
          return null
        }
        FS_stdin_getChar_buffer = intArrayFromString(result, true)
      }
      return FS_stdin_getChar_buffer.shift()
    }

    var TTY = {
      ttys: [],
      init() {},
      // https://github.com/emscripten-core/emscripten/pull/1555
      // if (ENVIRONMENT_IS_NODE) {
      //   // currently, FS.init does not distinguish if process.stdin is a file or TTY
      //   // device, it always assumes it's a TTY device. because of this, we're forcing
      //   // process.stdin to UTF8 encoding to at least make stdin reading compatible
      //   // with text files until FS.init can be refactored.
      //   process.stdin.setEncoding('utf8');
      // }
      shutdown() {},
      // https://github.com/emscripten-core/emscripten/pull/1555
      // if (ENVIRONMENT_IS_NODE) {
      //   // inolen: any idea as to why node -e 'process.stdin.read()' wouldn't exit immediately (with process.stdin being a tty)?
      //   // isaacs: because now it's reading from the stream, you've expressed interest in it, so that read() kicks off a _read() which creates a ReadReq operation
      //   // inolen: I thought read() in that case was a synchronous operation that just grabbed some amount of buffered data if it exists?
      //   // isaacs: it is. but it also triggers a _read() call, which calls readStart() on the handle
      //   // isaacs: do process.stdin.pause() and i'd think it'd probably close the pending call
      //   process.stdin.pause();
      // }
      register(dev, ops) {
        TTY.ttys[dev] = {
          input: [],
          output: [],
          ops: ops,
        }
        FS.registerDevice(dev, TTY.stream_ops)
      },
      stream_ops: {
        open(stream) {
          var tty = TTY.ttys[stream.node.rdev]
          if (!tty) {
            throw new FS.ErrnoError(43)
          }
          stream.tty = tty
          stream.seekable = false
        },
        close(stream) {
          // flush any pending line data
          stream.tty.ops.fsync(stream.tty)
        },
        fsync(stream) {
          stream.tty.ops.fsync(stream.tty)
        },
        read(stream, buffer, offset, length, pos) {
          /* ignored */ if (!stream.tty || !stream.tty.ops.get_char) {
            throw new FS.ErrnoError(60)
          }
          var bytesRead = 0
          for (var i = 0; i < length; i++) {
            var result
            try {
              result = stream.tty.ops.get_char(stream.tty)
            } catch (e) {
              throw new FS.ErrnoError(29)
            }
            if (result === undefined && bytesRead === 0) {
              throw new FS.ErrnoError(6)
            }
            if (result === null || result === undefined) break
            bytesRead++
            buffer[offset + i] = result
          }
          if (bytesRead) {
            stream.node.timestamp = Date.now()
          }
          return bytesRead
        },
        write(stream, buffer, offset, length, pos) {
          if (!stream.tty || !stream.tty.ops.put_char) {
            throw new FS.ErrnoError(60)
          }
          try {
            for (var i = 0; i < length; i++) {
              stream.tty.ops.put_char(stream.tty, buffer[offset + i])
            }
          } catch (e) {
            throw new FS.ErrnoError(29)
          }
          if (length) {
            stream.node.timestamp = Date.now()
          }
          return i
        },
      },
      default_tty_ops: {
        get_char(tty) {
          return FS_stdin_getChar()
        },
        put_char(tty, val) {
          if (val === null || val === 10) {
            out(UTF8ArrayToString(tty.output, 0))
            tty.output = []
          } else {
            if (val != 0) tty.output.push(val)
          }
        },
        // val == 0 would cut text output off in the middle.
        fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            out(UTF8ArrayToString(tty.output, 0))
            tty.output = []
          }
        },
        ioctl_tcgets(tty) {
          // typical setting
          return {
            c_iflag: 25856,
            c_oflag: 5,
            c_cflag: 191,
            c_lflag: 35387,
            c_cc: [
              3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0,
              0, 0, 0, 0, 0, 0, 0,
            ],
          }
        },
        ioctl_tcsets(tty, optional_actions, data) {
          // currently just ignore
          return 0
        },
        ioctl_tiocgwinsz(tty) {
          return [24, 80]
        },
      },
      default_tty1_ops: {
        put_char(tty, val) {
          if (val === null || val === 10) {
            err(UTF8ArrayToString(tty.output, 0))
            tty.output = []
          } else {
            if (val != 0) tty.output.push(val)
          }
        },
        fsync(tty) {
          if (tty.output && tty.output.length > 0) {
            err(UTF8ArrayToString(tty.output, 0))
            tty.output = []
          }
        },
      },
    }

    var mmapAlloc = (size) => {
      abort()
    }

    var MEMFS = {
      ops_table: null,
      mount(mount) {
        return MEMFS.createNode(null, '/', 16384 | 511, /* 0777 */ 0)
      },
      createNode(parent, name, mode, dev) {
        if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
          // no supported
          throw new FS.ErrnoError(63)
        }
        MEMFS.ops_table ||= {
          dir: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              lookup: MEMFS.node_ops.lookup,
              mknod: MEMFS.node_ops.mknod,
              rename: MEMFS.node_ops.rename,
              unlink: MEMFS.node_ops.unlink,
              rmdir: MEMFS.node_ops.rmdir,
              readdir: MEMFS.node_ops.readdir,
              symlink: MEMFS.node_ops.symlink,
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
            },
          },
          file: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
            },
            stream: {
              llseek: MEMFS.stream_ops.llseek,
              read: MEMFS.stream_ops.read,
              write: MEMFS.stream_ops.write,
              allocate: MEMFS.stream_ops.allocate,
              mmap: MEMFS.stream_ops.mmap,
              msync: MEMFS.stream_ops.msync,
            },
          },
          link: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
              readlink: MEMFS.node_ops.readlink,
            },
            stream: {},
          },
          chrdev: {
            node: {
              getattr: MEMFS.node_ops.getattr,
              setattr: MEMFS.node_ops.setattr,
            },
            stream: FS.chrdev_stream_ops,
          },
        }
        var node = FS.createNode(parent, name, mode, dev)
        if (FS.isDir(node.mode)) {
          node.node_ops = MEMFS.ops_table.dir.node
          node.stream_ops = MEMFS.ops_table.dir.stream
          node.contents = {}
        } else if (FS.isFile(node.mode)) {
          node.node_ops = MEMFS.ops_table.file.node
          node.stream_ops = MEMFS.ops_table.file.stream
          node.usedBytes = 0
          // The actual number of bytes used in the typed array, as opposed to contents.length which gives the whole capacity.
          // When the byte data of the file is populated, this will point to either a typed array, or a normal JS array. Typed arrays are preferred
          // for performance, and used by default. However, typed arrays are not resizable like normal JS arrays are, so there is a small disk size
          // penalty involved for appending file writes that continuously grow a file similar to std::vector capacity vs used -scheme.
          node.contents = null
        } else if (FS.isLink(node.mode)) {
          node.node_ops = MEMFS.ops_table.link.node
          node.stream_ops = MEMFS.ops_table.link.stream
        } else if (FS.isChrdev(node.mode)) {
          node.node_ops = MEMFS.ops_table.chrdev.node
          node.stream_ops = MEMFS.ops_table.chrdev.stream
        }
        node.timestamp = Date.now()
        // add the new node to the parent
        if (parent) {
          parent.contents[name] = node
          parent.timestamp = node.timestamp
        }
        return node
      },
      getFileDataAsTypedArray(node) {
        if (!node.contents) return new Uint8Array(0)
        if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes)
        // Make sure to not return excess unused bytes.
        return new Uint8Array(node.contents)
      },
      expandFileStorage(node, newCapacity) {
        var prevCapacity = node.contents ? node.contents.length : 0
        if (prevCapacity >= newCapacity) return
        // No need to expand, the storage was already large enough.
        // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
        // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
        // avoid overshooting the allocation cap by a very large margin.
        var CAPACITY_DOUBLING_MAX = 1024 * 1024
        newCapacity = Math.max(
          newCapacity,
          (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125)) >>> 0
        )
        if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256)
        // At minimum allocate 256b for each file when expanding.
        var oldContents = node.contents
        node.contents = new Uint8Array(newCapacity)
        // Allocate new storage.
        if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0)
      },
      // Copy old data over to the new storage.
      resizeFileStorage(node, newSize) {
        if (node.usedBytes == newSize) return
        if (newSize == 0) {
          node.contents = null
          // Fully decommit when requesting a resize to zero.
          node.usedBytes = 0
        } else {
          var oldContents = node.contents
          node.contents = new Uint8Array(newSize)
          // Allocate new storage.
          if (oldContents) {
            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
          }
          // Copy old data over to the new storage.
          node.usedBytes = newSize
        }
      },
      node_ops: {
        getattr(node) {
          var attr = {}
          // device numbers reuse inode numbers.
          attr.dev = FS.isChrdev(node.mode) ? node.id : 1
          attr.ino = node.id
          attr.mode = node.mode
          attr.nlink = 1
          attr.uid = 0
          attr.gid = 0
          attr.rdev = node.rdev
          if (FS.isDir(node.mode)) {
            attr.size = 4096
          } else if (FS.isFile(node.mode)) {
            attr.size = node.usedBytes
          } else if (FS.isLink(node.mode)) {
            attr.size = node.link.length
          } else {
            attr.size = 0
          }
          attr.atime = new Date(node.timestamp)
          attr.mtime = new Date(node.timestamp)
          attr.ctime = new Date(node.timestamp)
          // NOTE: In our implementation, st_blocks = Math.ceil(st_size/st_blksize),
          //       but this is not required by the standard.
          attr.blksize = 4096
          attr.blocks = Math.ceil(attr.size / attr.blksize)
          return attr
        },
        setattr(node, attr) {
          if (attr.mode !== undefined) {
            node.mode = attr.mode
          }
          if (attr.timestamp !== undefined) {
            node.timestamp = attr.timestamp
          }
          if (attr.size !== undefined) {
            MEMFS.resizeFileStorage(node, attr.size)
          }
        },
        lookup(parent, name) {
          throw FS.genericErrors[44]
        },
        mknod(parent, name, mode, dev) {
          return MEMFS.createNode(parent, name, mode, dev)
        },
        rename(old_node, new_dir, new_name) {
          // if we're overwriting a directory at new_name, make sure it's empty.
          if (FS.isDir(old_node.mode)) {
            var new_node
            try {
              new_node = FS.lookupNode(new_dir, new_name)
            } catch (e) {}
            if (new_node) {
              for (var i in new_node.contents) {
                throw new FS.ErrnoError(55)
              }
            }
          }
          // do the internal rewiring
          delete old_node.parent.contents[old_node.name]
          old_node.parent.timestamp = Date.now()
          old_node.name = new_name
          new_dir.contents[new_name] = old_node
          new_dir.timestamp = old_node.parent.timestamp
        },
        unlink(parent, name) {
          delete parent.contents[name]
          parent.timestamp = Date.now()
        },
        rmdir(parent, name) {
          var node = FS.lookupNode(parent, name)
          for (var i in node.contents) {
            throw new FS.ErrnoError(55)
          }
          delete parent.contents[name]
          parent.timestamp = Date.now()
        },
        readdir(node) {
          var entries = ['.', '..']
          for (var key of Object.keys(node.contents)) {
            entries.push(key)
          }
          return entries
        },
        symlink(parent, newname, oldpath) {
          var node = MEMFS.createNode(parent, newname, 511 | /* 0777 */ 40960, 0)
          node.link = oldpath
          return node
        },
        readlink(node) {
          if (!FS.isLink(node.mode)) {
            throw new FS.ErrnoError(28)
          }
          return node.link
        },
      },
      stream_ops: {
        read(stream, buffer, offset, length, position) {
          var contents = stream.node.contents
          if (position >= stream.node.usedBytes) return 0
          var size = Math.min(stream.node.usedBytes - position, length)
          if (size > 8 && contents.subarray) {
            // non-trivial, and typed array
            buffer.set(contents.subarray(position, position + size), offset)
          } else {
            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
          }
          return size
        },
        write(stream, buffer, offset, length, position, canOwn) {
          // If the buffer is located in main memory (HEAP), and if
          // memory can grow, we can't hold on to references of the
          // memory buffer, as they may get invalidated. That means we
          // need to do copy its contents.
          if (buffer.buffer === GROWABLE_HEAP_I8().buffer) {
            canOwn = false
          }
          if (!length) return 0
          var node = stream.node
          node.timestamp = Date.now()
          if (buffer.subarray && (!node.contents || node.contents.subarray)) {
            // This write is from a typed array to a typed array?
            if (canOwn) {
              node.contents = buffer.subarray(offset, offset + length)
              node.usedBytes = length
              return length
            } else if (node.usedBytes === 0 && position === 0) {
              // If this is a simple first write to an empty file, do a fast set since we don't need to care about old data.
              node.contents = buffer.slice(offset, offset + length)
              node.usedBytes = length
              return length
            } else if (position + length <= node.usedBytes) {
              // Writing to an already allocated and used subrange of the file?
              node.contents.set(buffer.subarray(offset, offset + length), position)
              return length
            }
          }
          // Appending to an existing file and we need to reallocate, or source data did not come as a typed array.
          MEMFS.expandFileStorage(node, position + length)
          if (node.contents.subarray && buffer.subarray) {
            // Use typed array write which is available.
            node.contents.set(buffer.subarray(offset, offset + length), position)
          } else {
            for (var i = 0; i < length; i++) {
              node.contents[position + i] = buffer[offset + i]
            }
          }
          node.usedBytes = Math.max(node.usedBytes, position + length)
          return length
        },
        llseek(stream, offset, whence) {
          var position = offset
          if (whence === 1) {
            position += stream.position
          } else if (whence === 2) {
            if (FS.isFile(stream.node.mode)) {
              position += stream.node.usedBytes
            }
          }
          if (position < 0) {
            throw new FS.ErrnoError(28)
          }
          return position
        },
        allocate(stream, offset, length) {
          MEMFS.expandFileStorage(stream.node, offset + length)
          stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
        },
        mmap(stream, length, position, prot, flags) {
          if (!FS.isFile(stream.node.mode)) {
            throw new FS.ErrnoError(43)
          }
          var ptr
          var allocated
          var contents = stream.node.contents
          // Only make a new copy when MAP_PRIVATE is specified.
          if (!(flags & 2) && contents.buffer === GROWABLE_HEAP_I8().buffer) {
            // We can't emulate MAP_SHARED when the file is not backed by the
            // buffer we're mapping to (e.g. the HEAP buffer).
            allocated = false
            ptr = contents.byteOffset
          } else {
            // Try to avoid unnecessary slices.
            if (position > 0 || position + length < contents.length) {
              if (contents.subarray) {
                contents = contents.subarray(position, position + length)
              } else {
                contents = Array.prototype.slice.call(contents, position, position + length)
              }
            }
            allocated = true
            ptr = mmapAlloc(length)
            if (!ptr) {
              throw new FS.ErrnoError(48)
            }
            GROWABLE_HEAP_I8().set(contents, ptr)
          }
          return {
            ptr: ptr,
            allocated: allocated,
          }
        },
        msync(stream, buffer, offset, length, mmapFlags) {
          MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false)
          // should we check if bytesWritten and length are the same?
          return 0
        },
      },
    }

    /** @param {boolean=} noRunDep */ var asyncLoad = (url, onload, onerror, noRunDep) => {
      var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : ''
      readAsync(url).then(
        (arrayBuffer) => {
          onload(new Uint8Array(arrayBuffer))
          if (dep) removeRunDependency(dep)
        },
        (err) => {
          if (onerror) {
            onerror()
          } else {
            throw `Loading data file "${url}" failed.`
          }
        }
      )
      if (dep) addRunDependency(dep)
    }

    var FS_createDataFile = (parent, name, fileData, canRead, canWrite, canOwn) => {
      FS.createDataFile(parent, name, fileData, canRead, canWrite, canOwn)
    }

    var preloadPlugins = Module['preloadPlugins'] || []

    var FS_handledByPreloadPlugin = (byteArray, fullname, finish, onerror) => {
      // Ensure plugins are ready.
      if (typeof Browser != 'undefined') Browser.init()
      var handled = false
      preloadPlugins.forEach((plugin) => {
        if (handled) return
        if (plugin['canHandle'](fullname)) {
          plugin['handle'](byteArray, fullname, finish, onerror)
          handled = true
        }
      })
      return handled
    }

    var FS_createPreloadedFile = (
      parent,
      name,
      url,
      canRead,
      canWrite,
      onload,
      onerror,
      dontCreateFile,
      canOwn,
      preFinish
    ) => {
      // TODO we should allow people to just pass in a complete filename instead
      // of parent and name being that we just join them anyways
      var fullname = name ? PATH_FS.resolve(PATH.join2(parent, name)) : parent
      var dep = getUniqueRunDependency(`cp ${fullname}`)
      // might have several active requests for the same fullname
      function processData(byteArray) {
        function finish(byteArray) {
          preFinish?.()
          if (!dontCreateFile) {
            FS_createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
          }
          onload?.()
          removeRunDependency(dep)
        }
        if (
          FS_handledByPreloadPlugin(byteArray, fullname, finish, () => {
            onerror?.()
            removeRunDependency(dep)
          })
        ) {
          return
        }
        finish(byteArray)
      }
      addRunDependency(dep)
      if (typeof url == 'string') {
        asyncLoad(url, processData, onerror)
      } else {
        processData(url)
      }
    }

    var FS_modeStringToFlags = (str) => {
      var flagModes = {
        r: 0,
        'r+': 2,
        w: 512 | 64 | 1,
        'w+': 512 | 64 | 2,
        a: 1024 | 64 | 1,
        'a+': 1024 | 64 | 2,
      }
      var flags = flagModes[str]
      if (typeof flags == 'undefined') {
        throw new Error(`Unknown file open mode: ${str}`)
      }
      return flags
    }

    var FS_getMode = (canRead, canWrite) => {
      var mode = 0
      if (canRead) mode |= 292 | 73
      if (canWrite) mode |= 146
      return mode
    }

    var FS = {
      root: null,
      mounts: [],
      devices: {},
      streams: [],
      nextInode: 1,
      nameTable: null,
      currentPath: '/',
      initialized: false,
      ignorePermissions: true,
      ErrnoError: class {
        // We set the `name` property to be able to identify `FS.ErrnoError`
        // - the `name` is a standard ECMA-262 property of error objects. Kind of good to have it anyway.
        // - when using PROXYFS, an error can come from an underlying FS
        // as different FS objects have their own FS.ErrnoError each,
        // the test `err instanceof FS.ErrnoError` won't detect an error coming from another filesystem, causing bugs.
        // we'll use the reliable test `err.name == "ErrnoError"` instead
        constructor(errno) {
          // TODO(sbc): Use the inline member declaration syntax once we
          // support it in acorn and closure.
          this.name = 'ErrnoError'
          this.errno = errno
        }
      },
      genericErrors: {},
      filesystems: null,
      syncFSRequests: 0,
      FSStream: class {
        constructor() {
          // TODO(https://github.com/emscripten-core/emscripten/issues/21414):
          // Use inline field declarations.
          this.shared = {}
        }
        get object() {
          return this.node
        }
        set object(val) {
          this.node = val
        }
        get isRead() {
          return (this.flags & 2097155) !== 1
        }
        get isWrite() {
          return (this.flags & 2097155) !== 0
        }
        get isAppend() {
          return this.flags & 1024
        }
        get flags() {
          return this.shared.flags
        }
        set flags(val) {
          this.shared.flags = val
        }
        get position() {
          return this.shared.position
        }
        set position(val) {
          this.shared.position = val
        }
      },
      FSNode: class {
        constructor(parent, name, mode, rdev) {
          if (!parent) {
            parent = this
          }
          // root node sets parent to itself
          this.parent = parent
          this.mount = parent.mount
          this.mounted = null
          this.id = FS.nextInode++
          this.name = name
          this.mode = mode
          this.node_ops = {}
          this.stream_ops = {}
          this.rdev = rdev
          this.readMode = 292 | /*292*/ 73
          /*73*/ this.writeMode = 146
        }
        /*146*/ get read() {
          return (this.mode & this.readMode) === this.readMode
        }
        set read(val) {
          val ? (this.mode |= this.readMode) : (this.mode &= ~this.readMode)
        }
        get write() {
          return (this.mode & this.writeMode) === this.writeMode
        }
        set write(val) {
          val ? (this.mode |= this.writeMode) : (this.mode &= ~this.writeMode)
        }
        get isFolder() {
          return FS.isDir(this.mode)
        }
        get isDevice() {
          return FS.isChrdev(this.mode)
        }
      },
      lookupPath(path, opts = {}) {
        path = PATH_FS.resolve(path)
        if (!path)
          return {
            path: '',
            node: null,
          }
        var defaults = {
          follow_mount: true,
          recurse_count: 0,
        }
        opts = Object.assign(defaults, opts)
        if (opts.recurse_count > 8) {
          // max recursive lookup of 8
          throw new FS.ErrnoError(32)
        }
        // split the absolute path
        var parts = path.split('/').filter((p) => !!p)
        // start at the root
        var current = FS.root
        var current_path = '/'
        for (var i = 0; i < parts.length; i++) {
          var islast = i === parts.length - 1
          if (islast && opts.parent) {
            // stop resolving
            break
          }
          current = FS.lookupNode(current, parts[i])
          current_path = PATH.join2(current_path, parts[i])
          // jump to the mount's root node if this is a mountpoint
          if (FS.isMountpoint(current)) {
            if (!islast || (islast && opts.follow_mount)) {
              current = current.mounted.root
            }
          }
          // by default, lookupPath will not follow a symlink if it is the final path component.
          // setting opts.follow = true will override this behavior.
          if (!islast || opts.follow) {
            var count = 0
            while (FS.isLink(current.mode)) {
              var link = FS.readlink(current_path)
              current_path = PATH_FS.resolve(PATH.dirname(current_path), link)
              var lookup = FS.lookupPath(current_path, {
                recurse_count: opts.recurse_count + 1,
              })
              current = lookup.node
              if (count++ > 40) {
                // limit max consecutive symlinks to 40 (SYMLOOP_MAX).
                throw new FS.ErrnoError(32)
              }
            }
          }
        }
        return {
          path: current_path,
          node: current,
        }
      },
      getPath(node) {
        var path
        while (true) {
          if (FS.isRoot(node)) {
            var mount = node.mount.mountpoint
            if (!path) return mount
            return mount[mount.length - 1] !== '/' ? `${mount}/${path}` : mount + path
          }
          path = path ? `${node.name}/${path}` : node.name
          node = node.parent
        }
      },
      hashName(parentid, name) {
        var hash = 0
        for (var i = 0; i < name.length; i++) {
          hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
        }
        return ((parentid + hash) >>> 0) % FS.nameTable.length
      },
      hashAddNode(node) {
        var hash = FS.hashName(node.parent.id, node.name)
        node.name_next = FS.nameTable[hash]
        FS.nameTable[hash] = node
      },
      hashRemoveNode(node) {
        var hash = FS.hashName(node.parent.id, node.name)
        if (FS.nameTable[hash] === node) {
          FS.nameTable[hash] = node.name_next
        } else {
          var current = FS.nameTable[hash]
          while (current) {
            if (current.name_next === node) {
              current.name_next = node.name_next
              break
            }
            current = current.name_next
          }
        }
      },
      lookupNode(parent, name) {
        var errCode = FS.mayLookup(parent)
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        var hash = FS.hashName(parent.id, name)
        for (var node = FS.nameTable[hash]; node; node = node.name_next) {
          var nodeName = node.name
          if (node.parent.id === parent.id && nodeName === name) {
            return node
          }
        }
        // if we failed to find it in the cache, call into the VFS
        return FS.lookup(parent, name)
      },
      createNode(parent, name, mode, rdev) {
        var node = new FS.FSNode(parent, name, mode, rdev)
        FS.hashAddNode(node)
        return node
      },
      destroyNode(node) {
        FS.hashRemoveNode(node)
      },
      isRoot(node) {
        return node === node.parent
      },
      isMountpoint(node) {
        return !!node.mounted
      },
      isFile(mode) {
        return (mode & 61440) === 32768
      },
      isDir(mode) {
        return (mode & 61440) === 16384
      },
      isLink(mode) {
        return (mode & 61440) === 40960
      },
      isChrdev(mode) {
        return (mode & 61440) === 8192
      },
      isBlkdev(mode) {
        return (mode & 61440) === 24576
      },
      isFIFO(mode) {
        return (mode & 61440) === 4096
      },
      isSocket(mode) {
        return (mode & 49152) === 49152
      },
      flagsToPermissionString(flag) {
        var perms = ['r', 'w', 'rw'][flag & 3]
        if (flag & 512) {
          perms += 'w'
        }
        return perms
      },
      nodePermissions(node, perms) {
        if (FS.ignorePermissions) {
          return 0
        }
        // return 0 if any user, group or owner bits are set.
        if (perms.includes('r') && !(node.mode & 292)) {
          return 2
        } else if (perms.includes('w') && !(node.mode & 146)) {
          return 2
        } else if (perms.includes('x') && !(node.mode & 73)) {
          return 2
        }
        return 0
      },
      mayLookup(dir) {
        if (!FS.isDir(dir.mode)) return 54
        var errCode = FS.nodePermissions(dir, 'x')
        if (errCode) return errCode
        if (!dir.node_ops.lookup) return 2
        return 0
      },
      mayCreate(dir, name) {
        try {
          var node = FS.lookupNode(dir, name)
          return 20
        } catch (e) {}
        return FS.nodePermissions(dir, 'wx')
      },
      mayDelete(dir, name, isdir) {
        var node
        try {
          node = FS.lookupNode(dir, name)
        } catch (e) {
          return e.errno
        }
        var errCode = FS.nodePermissions(dir, 'wx')
        if (errCode) {
          return errCode
        }
        if (isdir) {
          if (!FS.isDir(node.mode)) {
            return 54
          }
          if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
            return 10
          }
        } else {
          if (FS.isDir(node.mode)) {
            return 31
          }
        }
        return 0
      },
      mayOpen(node, flags) {
        if (!node) {
          return 44
        }
        if (FS.isLink(node.mode)) {
          return 32
        } else if (FS.isDir(node.mode)) {
          if (
            FS.flagsToPermissionString(flags) !== 'r' || // opening for write
            flags & 512
          ) {
            // TODO: check for O_SEARCH? (== search for dir only)
            return 31
          }
        }
        return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
      },
      MAX_OPEN_FDS: 4096,
      nextfd() {
        for (var fd = 0; fd <= FS.MAX_OPEN_FDS; fd++) {
          if (!FS.streams[fd]) {
            return fd
          }
        }
        throw new FS.ErrnoError(33)
      },
      getStreamChecked(fd) {
        var stream = FS.getStream(fd)
        if (!stream) {
          throw new FS.ErrnoError(8)
        }
        return stream
      },
      getStream: (fd) => FS.streams[fd],
      createStream(stream, fd = -1) {
        // clone it, so we can return an instance of FSStream
        stream = Object.assign(new FS.FSStream(), stream)
        if (fd == -1) {
          fd = FS.nextfd()
        }
        stream.fd = fd
        FS.streams[fd] = stream
        return stream
      },
      closeStream(fd) {
        FS.streams[fd] = null
      },
      dupStream(origStream, fd = -1) {
        var stream = FS.createStream(origStream, fd)
        stream.stream_ops?.dup?.(stream)
        return stream
      },
      chrdev_stream_ops: {
        open(stream) {
          var device = FS.getDevice(stream.node.rdev)
          // override node's stream ops with the device's
          stream.stream_ops = device.stream_ops
          // forward the open call
          stream.stream_ops.open?.(stream)
        },
        llseek() {
          throw new FS.ErrnoError(70)
        },
      },
      major: (dev) => dev >> 8,
      minor: (dev) => dev & 255,
      makedev: (ma, mi) => (ma << 8) | mi,
      registerDevice(dev, ops) {
        FS.devices[dev] = {
          stream_ops: ops,
        }
      },
      getDevice: (dev) => FS.devices[dev],
      getMounts(mount) {
        var mounts = []
        var check = [mount]
        while (check.length) {
          var m = check.pop()
          mounts.push(m)
          check.push(...m.mounts)
        }
        return mounts
      },
      syncfs(populate, callback) {
        if (typeof populate == 'function') {
          callback = populate
          populate = false
        }
        FS.syncFSRequests++
        if (FS.syncFSRequests > 1) {
          err(
            `warning: ${FS.syncFSRequests} FS.syncfs operations in flight at once, probably just doing extra work`
          )
        }
        var mounts = FS.getMounts(FS.root.mount)
        var completed = 0
        function doCallback(errCode) {
          FS.syncFSRequests--
          return callback(errCode)
        }
        function done(errCode) {
          if (errCode) {
            if (!done.errored) {
              done.errored = true
              return doCallback(errCode)
            }
            return
          }
          if (++completed >= mounts.length) {
            doCallback(null)
          }
        }
        // sync all mounts
        mounts.forEach((mount) => {
          if (!mount.type.syncfs) {
            return done(null)
          }
          mount.type.syncfs(mount, populate, done)
        })
      },
      mount(type, opts, mountpoint) {
        var root = mountpoint === '/'
        var pseudo = !mountpoint
        var node
        if (root && FS.root) {
          throw new FS.ErrnoError(10)
        } else if (!root && !pseudo) {
          var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false,
          })
          mountpoint = lookup.path
          // use the absolute path
          node = lookup.node
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(10)
          }
          if (!FS.isDir(node.mode)) {
            throw new FS.ErrnoError(54)
          }
        }
        var mount = {
          type: type,
          opts: opts,
          mountpoint: mountpoint,
          mounts: [],
        }
        // create a root node for the fs
        var mountRoot = type.mount(mount)
        mountRoot.mount = mount
        mount.root = mountRoot
        if (root) {
          FS.root = mountRoot
        } else if (node) {
          // set as a mountpoint
          node.mounted = mount
          // add the new mount to the current mount's children
          if (node.mount) {
            node.mount.mounts.push(mount)
          }
        }
        return mountRoot
      },
      unmount(mountpoint) {
        var lookup = FS.lookupPath(mountpoint, {
          follow_mount: false,
        })
        if (!FS.isMountpoint(lookup.node)) {
          throw new FS.ErrnoError(28)
        }
        // destroy the nodes for this mount, and all its child mounts
        var node = lookup.node
        var mount = node.mounted
        var mounts = FS.getMounts(mount)
        Object.keys(FS.nameTable).forEach((hash) => {
          var current = FS.nameTable[hash]
          while (current) {
            var next = current.name_next
            if (mounts.includes(current.mount)) {
              FS.destroyNode(current)
            }
            current = next
          }
        })
        // no longer a mountpoint
        node.mounted = null
        // remove this mount from the child mounts
        var idx = node.mount.mounts.indexOf(mount)
        node.mount.mounts.splice(idx, 1)
      },
      lookup(parent, name) {
        return parent.node_ops.lookup(parent, name)
      },
      mknod(path, mode, dev) {
        var lookup = FS.lookupPath(path, {
          parent: true,
        })
        var parent = lookup.node
        var name = PATH.basename(path)
        if (!name || name === '.' || name === '..') {
          throw new FS.ErrnoError(28)
        }
        var errCode = FS.mayCreate(parent, name)
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.mknod) {
          throw new FS.ErrnoError(63)
        }
        return parent.node_ops.mknod(parent, name, mode, dev)
      },
      create(path, mode) {
        mode = mode !== undefined ? mode : 438
        /* 0666 */ mode &= 4095
        mode |= 32768
        return FS.mknod(path, mode, 0)
      },
      mkdir(path, mode) {
        mode = mode !== undefined ? mode : 511
        /* 0777 */ mode &= 511 | 512
        mode |= 16384
        return FS.mknod(path, mode, 0)
      },
      mkdirTree(path, mode) {
        var dirs = path.split('/')
        var d = ''
        for (var i = 0; i < dirs.length; ++i) {
          if (!dirs[i]) continue
          d += '/' + dirs[i]
          try {
            FS.mkdir(d, mode)
          } catch (e) {
            if (e.errno != 20) throw e
          }
        }
      },
      mkdev(path, mode, dev) {
        if (typeof dev == 'undefined') {
          dev = mode
          mode = 438
        }
        /* 0666 */ mode |= 8192
        return FS.mknod(path, mode, dev)
      },
      symlink(oldpath, newpath) {
        if (!PATH_FS.resolve(oldpath)) {
          throw new FS.ErrnoError(44)
        }
        var lookup = FS.lookupPath(newpath, {
          parent: true,
        })
        var parent = lookup.node
        if (!parent) {
          throw new FS.ErrnoError(44)
        }
        var newname = PATH.basename(newpath)
        var errCode = FS.mayCreate(parent, newname)
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.symlink) {
          throw new FS.ErrnoError(63)
        }
        return parent.node_ops.symlink(parent, newname, oldpath)
      },
      rename(old_path, new_path) {
        var old_dirname = PATH.dirname(old_path)
        var new_dirname = PATH.dirname(new_path)
        var old_name = PATH.basename(old_path)
        var new_name = PATH.basename(new_path)
        // parents must exist
        var lookup, old_dir, new_dir
        // let the errors from non existent directories percolate up
        lookup = FS.lookupPath(old_path, {
          parent: true,
        })
        old_dir = lookup.node
        lookup = FS.lookupPath(new_path, {
          parent: true,
        })
        new_dir = lookup.node
        if (!old_dir || !new_dir) throw new FS.ErrnoError(44)
        // need to be part of the same mount
        if (old_dir.mount !== new_dir.mount) {
          throw new FS.ErrnoError(75)
        }
        // source must exist
        var old_node = FS.lookupNode(old_dir, old_name)
        // old path should not be an ancestor of the new path
        var relative = PATH_FS.relative(old_path, new_dirname)
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(28)
        }
        // new path should not be an ancestor of the old path
        relative = PATH_FS.relative(new_path, old_dirname)
        if (relative.charAt(0) !== '.') {
          throw new FS.ErrnoError(55)
        }
        // see if the new path already exists
        var new_node
        try {
          new_node = FS.lookupNode(new_dir, new_name)
        } catch (e) {}
        // early out if nothing needs to change
        if (old_node === new_node) {
          return
        }
        // we'll need to delete the old entry
        var isdir = FS.isDir(old_node.mode)
        var errCode = FS.mayDelete(old_dir, old_name, isdir)
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        // need delete permissions if we'll be overwriting.
        // need create permissions if new doesn't already exist.
        errCode = new_node
          ? FS.mayDelete(new_dir, new_name, isdir)
          : FS.mayCreate(new_dir, new_name)
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        if (!old_dir.node_ops.rename) {
          throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(old_node) || (new_node && FS.isMountpoint(new_node))) {
          throw new FS.ErrnoError(10)
        }
        // if we are going to change the parent, check write permissions
        if (new_dir !== old_dir) {
          errCode = FS.nodePermissions(old_dir, 'w')
          if (errCode) {
            throw new FS.ErrnoError(errCode)
          }
        }
        // remove the node from the lookup hash
        FS.hashRemoveNode(old_node)
        // do the underlying fs rename
        try {
          old_dir.node_ops.rename(old_node, new_dir, new_name)
          // update old node (we do this here to avoid each backend
          // needing to)
          old_node.parent = new_dir
        } catch (e) {
          throw e
        } finally {
          // add the node back to the hash (in case node_ops.rename
          // changed its name)
          FS.hashAddNode(old_node)
        }
      },
      rmdir(path) {
        var lookup = FS.lookupPath(path, {
          parent: true,
        })
        var parent = lookup.node
        var name = PATH.basename(path)
        var node = FS.lookupNode(parent, name)
        var errCode = FS.mayDelete(parent, name, true)
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.rmdir) {
          throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10)
        }
        parent.node_ops.rmdir(parent, name)
        FS.destroyNode(node)
      },
      readdir(path) {
        var lookup = FS.lookupPath(path, {
          follow: true,
        })
        var node = lookup.node
        if (!node.node_ops.readdir) {
          throw new FS.ErrnoError(54)
        }
        return node.node_ops.readdir(node)
      },
      unlink(path) {
        var lookup = FS.lookupPath(path, {
          parent: true,
        })
        var parent = lookup.node
        if (!parent) {
          throw new FS.ErrnoError(44)
        }
        var name = PATH.basename(path)
        var node = FS.lookupNode(parent, name)
        var errCode = FS.mayDelete(parent, name, false)
        if (errCode) {
          // According to POSIX, we should map EISDIR to EPERM, but
          // we instead do what Linux does (and we must, as we use
          // the musl linux libc).
          throw new FS.ErrnoError(errCode)
        }
        if (!parent.node_ops.unlink) {
          throw new FS.ErrnoError(63)
        }
        if (FS.isMountpoint(node)) {
          throw new FS.ErrnoError(10)
        }
        parent.node_ops.unlink(parent, name)
        FS.destroyNode(node)
      },
      readlink(path) {
        var lookup = FS.lookupPath(path)
        var link = lookup.node
        if (!link) {
          throw new FS.ErrnoError(44)
        }
        if (!link.node_ops.readlink) {
          throw new FS.ErrnoError(28)
        }
        return PATH_FS.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
      },
      stat(path, dontFollow) {
        var lookup = FS.lookupPath(path, {
          follow: !dontFollow,
        })
        var node = lookup.node
        if (!node) {
          throw new FS.ErrnoError(44)
        }
        if (!node.node_ops.getattr) {
          throw new FS.ErrnoError(63)
        }
        return node.node_ops.getattr(node)
      },
      lstat(path) {
        return FS.stat(path, true)
      },
      chmod(path, mode, dontFollow) {
        var node
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow,
          })
          node = lookup.node
        } else {
          node = path
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63)
        }
        node.node_ops.setattr(node, {
          mode: (mode & 4095) | (node.mode & ~4095),
          timestamp: Date.now(),
        })
      },
      lchmod(path, mode) {
        FS.chmod(path, mode, true)
      },
      fchmod(fd, mode) {
        var stream = FS.getStreamChecked(fd)
        FS.chmod(stream.node, mode)
      },
      chown(path, uid, gid, dontFollow) {
        var node
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow,
          })
          node = lookup.node
        } else {
          node = path
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63)
        }
        node.node_ops.setattr(node, {
          timestamp: Date.now(),
        })
      },
      // we ignore the uid / gid for now
      lchown(path, uid, gid) {
        FS.chown(path, uid, gid, true)
      },
      fchown(fd, uid, gid) {
        var stream = FS.getStreamChecked(fd)
        FS.chown(stream.node, uid, gid)
      },
      truncate(path, len) {
        if (len < 0) {
          throw new FS.ErrnoError(28)
        }
        var node
        if (typeof path == 'string') {
          var lookup = FS.lookupPath(path, {
            follow: true,
          })
          node = lookup.node
        } else {
          node = path
        }
        if (!node.node_ops.setattr) {
          throw new FS.ErrnoError(63)
        }
        if (FS.isDir(node.mode)) {
          throw new FS.ErrnoError(31)
        }
        if (!FS.isFile(node.mode)) {
          throw new FS.ErrnoError(28)
        }
        var errCode = FS.nodePermissions(node, 'w')
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        node.node_ops.setattr(node, {
          size: len,
          timestamp: Date.now(),
        })
      },
      ftruncate(fd, len) {
        var stream = FS.getStreamChecked(fd)
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(28)
        }
        FS.truncate(stream.node, len)
      },
      utime(path, atime, mtime) {
        var lookup = FS.lookupPath(path, {
          follow: true,
        })
        var node = lookup.node
        node.node_ops.setattr(node, {
          timestamp: Math.max(atime, mtime),
        })
      },
      open(path, flags, mode) {
        if (path === '') {
          throw new FS.ErrnoError(44)
        }
        flags = typeof flags == 'string' ? FS_modeStringToFlags(flags) : flags
        if (flags & 64) {
          mode = typeof mode == 'undefined' ? 438 : /* 0666 */ mode
          mode = (mode & 4095) | 32768
        } else {
          mode = 0
        }
        var node
        if (typeof path == 'object') {
          node = path
        } else {
          path = PATH.normalize(path)
          try {
            var lookup = FS.lookupPath(path, {
              follow: !(flags & 131072),
            })
            node = lookup.node
          } catch (e) {}
        }
        // perhaps we need to create the node
        var created = false
        if (flags & 64) {
          if (node) {
            // if O_CREAT and O_EXCL are set, error out if the node already exists
            if (flags & 128) {
              throw new FS.ErrnoError(20)
            }
          } else {
            // node doesn't exist, try to create it
            node = FS.mknod(path, mode, 0)
            created = true
          }
        }
        if (!node) {
          throw new FS.ErrnoError(44)
        }
        // can't truncate a device
        if (FS.isChrdev(node.mode)) {
          flags &= ~512
        }
        // if asked only for a directory, then this must be one
        if (flags & 65536 && !FS.isDir(node.mode)) {
          throw new FS.ErrnoError(54)
        }
        // check permissions, if this is not a file we just created now (it is ok to
        // create and write to a file with read-only permissions; it is read-only
        // for later use)
        if (!created) {
          var errCode = FS.mayOpen(node, flags)
          if (errCode) {
            throw new FS.ErrnoError(errCode)
          }
        }
        // do truncation if necessary
        if (flags & 512 && !created) {
          FS.truncate(node, 0)
        }
        // we've already handled these, don't pass down to the underlying vfs
        flags &= ~(128 | 512 | 131072)
        // register the stream with the filesystem
        var stream = FS.createStream({
          node: node,
          path: FS.getPath(node),
          // we want the absolute path to the node
          flags: flags,
          seekable: true,
          position: 0,
          stream_ops: node.stream_ops,
          // used by the file family libc calls (fopen, fwrite, ferror, etc.)
          ungotten: [],
          error: false,
        })
        // call the new stream's open function
        if (stream.stream_ops.open) {
          stream.stream_ops.open(stream)
        }
        if (Module['logReadFiles'] && !(flags & 1)) {
          if (!FS.readFiles) FS.readFiles = {}
          if (!(path in FS.readFiles)) {
            FS.readFiles[path] = 1
          }
        }
        return stream
      },
      close(stream) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8)
        }
        if (stream.getdents) stream.getdents = null
        // free readdir state
        try {
          if (stream.stream_ops.close) {
            stream.stream_ops.close(stream)
          }
        } catch (e) {
          throw e
        } finally {
          FS.closeStream(stream.fd)
        }
        stream.fd = null
      },
      isClosed(stream) {
        return stream.fd === null
      },
      llseek(stream, offset, whence) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8)
        }
        if (!stream.seekable || !stream.stream_ops.llseek) {
          throw new FS.ErrnoError(70)
        }
        if (whence != 0 && whence != 1 && whence != 2) {
          throw new FS.ErrnoError(28)
        }
        stream.position = stream.stream_ops.llseek(stream, offset, whence)
        stream.ungotten = []
        return stream.position
      },
      read(stream, buffer, offset, length, position) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28)
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(8)
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31)
        }
        if (!stream.stream_ops.read) {
          throw new FS.ErrnoError(28)
        }
        var seeking = typeof position != 'undefined'
        if (!seeking) {
          position = stream.position
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70)
        }
        var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position)
        if (!seeking) stream.position += bytesRead
        return bytesRead
      },
      write(stream, buffer, offset, length, position, canOwn) {
        if (length < 0 || position < 0) {
          throw new FS.ErrnoError(28)
        }
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8)
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8)
        }
        if (FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(31)
        }
        if (!stream.stream_ops.write) {
          throw new FS.ErrnoError(28)
        }
        if (stream.seekable && stream.flags & 1024) {
          // seek to the end before writing in append mode
          FS.llseek(stream, 0, 2)
        }
        var seeking = typeof position != 'undefined'
        if (!seeking) {
          position = stream.position
        } else if (!stream.seekable) {
          throw new FS.ErrnoError(70)
        }
        var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn)
        if (!seeking) stream.position += bytesWritten
        return bytesWritten
      },
      allocate(stream, offset, length) {
        if (FS.isClosed(stream)) {
          throw new FS.ErrnoError(8)
        }
        if (offset < 0 || length <= 0) {
          throw new FS.ErrnoError(28)
        }
        if ((stream.flags & 2097155) === 0) {
          throw new FS.ErrnoError(8)
        }
        if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
          throw new FS.ErrnoError(43)
        }
        if (!stream.stream_ops.allocate) {
          throw new FS.ErrnoError(138)
        }
        stream.stream_ops.allocate(stream, offset, length)
      },
      mmap(stream, length, position, prot, flags) {
        // User requests writing to file (prot & PROT_WRITE != 0).
        // Checking if we have permissions to write to the file unless
        // MAP_PRIVATE flag is set. According to POSIX spec it is possible
        // to write to file opened in read-only mode with MAP_PRIVATE flag,
        // as all modifications will be visible only in the memory of
        // the current process.
        if ((prot & 2) !== 0 && (flags & 2) === 0 && (stream.flags & 2097155) !== 2) {
          throw new FS.ErrnoError(2)
        }
        if ((stream.flags & 2097155) === 1) {
          throw new FS.ErrnoError(2)
        }
        if (!stream.stream_ops.mmap) {
          throw new FS.ErrnoError(43)
        }
        return stream.stream_ops.mmap(stream, length, position, prot, flags)
      },
      msync(stream, buffer, offset, length, mmapFlags) {
        if (!stream.stream_ops.msync) {
          return 0
        }
        return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
      },
      ioctl(stream, cmd, arg) {
        if (!stream.stream_ops.ioctl) {
          throw new FS.ErrnoError(59)
        }
        return stream.stream_ops.ioctl(stream, cmd, arg)
      },
      readFile(path, opts = {}) {
        opts.flags = opts.flags || 0
        opts.encoding = opts.encoding || 'binary'
        if (opts.encoding !== 'utf8' && opts.encoding !== 'binary') {
          throw new Error(`Invalid encoding type "${opts.encoding}"`)
        }
        var ret
        var stream = FS.open(path, opts.flags)
        var stat = FS.stat(path)
        var length = stat.size
        var buf = new Uint8Array(length)
        FS.read(stream, buf, 0, length, 0)
        if (opts.encoding === 'utf8') {
          ret = UTF8ArrayToString(buf, 0)
        } else if (opts.encoding === 'binary') {
          ret = buf
        }
        FS.close(stream)
        return ret
      },
      writeFile(path, data, opts = {}) {
        opts.flags = opts.flags || 577
        var stream = FS.open(path, opts.flags, opts.mode)
        if (typeof data == 'string') {
          var buf = new Uint8Array(lengthBytesUTF8(data) + 1)
          var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length)
          FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
        } else if (ArrayBuffer.isView(data)) {
          FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
        } else {
          throw new Error('Unsupported data type')
        }
        FS.close(stream)
      },
      cwd: () => FS.currentPath,
      chdir(path) {
        var lookup = FS.lookupPath(path, {
          follow: true,
        })
        if (lookup.node === null) {
          throw new FS.ErrnoError(44)
        }
        if (!FS.isDir(lookup.node.mode)) {
          throw new FS.ErrnoError(54)
        }
        var errCode = FS.nodePermissions(lookup.node, 'x')
        if (errCode) {
          throw new FS.ErrnoError(errCode)
        }
        FS.currentPath = lookup.path
      },
      createDefaultDirectories() {
        FS.mkdir('/tmp')
        FS.mkdir('/home')
        FS.mkdir('/home/web_user')
      },
      createDefaultDevices() {
        // create /dev
        FS.mkdir('/dev')
        // setup /dev/null
        FS.registerDevice(FS.makedev(1, 3), {
          read: () => 0,
          write: (stream, buffer, offset, length, pos) => length,
        })
        FS.mkdev('/dev/null', FS.makedev(1, 3))
        // setup /dev/tty and /dev/tty1
        // stderr needs to print output using err() rather than out()
        // so we register a second tty just for it.
        TTY.register(FS.makedev(5, 0), TTY.default_tty_ops)
        TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops)
        FS.mkdev('/dev/tty', FS.makedev(5, 0))
        FS.mkdev('/dev/tty1', FS.makedev(6, 0))
        // setup /dev/[u]random
        // use a buffer to avoid overhead of individual crypto calls per byte
        var randomBuffer = new Uint8Array(1024),
          randomLeft = 0
        var randomByte = () => {
          if (randomLeft === 0) {
            randomLeft = randomFill(randomBuffer).byteLength
          }
          return randomBuffer[--randomLeft]
        }
        FS.createDevice('/dev', 'random', randomByte)
        FS.createDevice('/dev', 'urandom', randomByte)
        // we're not going to emulate the actual shm device,
        // just create the tmp dirs that reside in it commonly
        FS.mkdir('/dev/shm')
        FS.mkdir('/dev/shm/tmp')
      },
      createSpecialDirectories() {
        // create /proc/self/fd which allows /proc/self/fd/6 => readlink gives the
        // name of the stream for fd 6 (see test_unistd_ttyname)
        FS.mkdir('/proc')
        var proc_self = FS.mkdir('/proc/self')
        FS.mkdir('/proc/self/fd')
        FS.mount(
          {
            mount() {
              var node = FS.createNode(proc_self, 'fd', 16384 | 511, /* 0777 */ 73)
              node.node_ops = {
                lookup(parent, name) {
                  var fd = +name
                  var stream = FS.getStreamChecked(fd)
                  var ret = {
                    parent: null,
                    mount: {
                      mountpoint: 'fake',
                    },
                    node_ops: {
                      readlink: () => stream.path,
                    },
                  }
                  ret.parent = ret
                  // make it look like a simple root node
                  return ret
                },
              }
              return node
            },
          },
          {},
          '/proc/self/fd'
        )
      },
      createStandardStreams() {
        // TODO deprecate the old functionality of a single
        // input / output callback and that utilizes FS.createDevice
        // and instead require a unique set of stream ops
        // by default, we symlink the standard streams to the
        // default tty devices. however, if the standard streams
        // have been overwritten we create a unique device for
        // them instead.
        if (Module['stdin']) {
          FS.createDevice('/dev', 'stdin', Module['stdin'])
        } else {
          FS.symlink('/dev/tty', '/dev/stdin')
        }
        if (Module['stdout']) {
          FS.createDevice('/dev', 'stdout', null, Module['stdout'])
        } else {
          FS.symlink('/dev/tty', '/dev/stdout')
        }
        if (Module['stderr']) {
          FS.createDevice('/dev', 'stderr', null, Module['stderr'])
        } else {
          FS.symlink('/dev/tty1', '/dev/stderr')
        }
        // open default streams for the stdin, stdout and stderr devices
        var stdin = FS.open('/dev/stdin', 0)
        var stdout = FS.open('/dev/stdout', 1)
        var stderr = FS.open('/dev/stderr', 1)
      },
      staticInit() {
        // Some errors may happen quite a bit, to avoid overhead we reuse them (and suffer a lack of stack info)
        ;[44].forEach((code) => {
          FS.genericErrors[code] = new FS.ErrnoError(code)
          FS.genericErrors[code].stack = '<generic error, no stack>'
        })
        FS.nameTable = new Array(4096)
        FS.mount(MEMFS, {}, '/')
        FS.createDefaultDirectories()
        FS.createDefaultDevices()
        FS.createSpecialDirectories()
        FS.filesystems = {
          MEMFS: MEMFS,
        }
      },
      init(input, output, error) {
        FS.init.initialized = true
        // Allow Module.stdin etc. to provide defaults, if none explicitly passed to us here
        Module['stdin'] = input || Module['stdin']
        Module['stdout'] = output || Module['stdout']
        Module['stderr'] = error || Module['stderr']
        FS.createStandardStreams()
      },
      quit() {
        FS.init.initialized = false
        // force-flush all streams, so we get musl std streams printed out
        _fflush(0)
        // close all of our streams
        for (var i = 0; i < FS.streams.length; i++) {
          var stream = FS.streams[i]
          if (!stream) {
            continue
          }
          FS.close(stream)
        }
      },
      findObject(path, dontResolveLastLink) {
        var ret = FS.analyzePath(path, dontResolveLastLink)
        if (!ret.exists) {
          return null
        }
        return ret.object
      },
      analyzePath(path, dontResolveLastLink) {
        // operate from within the context of the symlink's target
        try {
          var lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink,
          })
          path = lookup.path
        } catch (e) {}
        var ret = {
          isRoot: false,
          exists: false,
          error: 0,
          name: null,
          path: null,
          object: null,
          parentExists: false,
          parentPath: null,
          parentObject: null,
        }
        try {
          var lookup = FS.lookupPath(path, {
            parent: true,
          })
          ret.parentExists = true
          ret.parentPath = lookup.path
          ret.parentObject = lookup.node
          ret.name = PATH.basename(path)
          lookup = FS.lookupPath(path, {
            follow: !dontResolveLastLink,
          })
          ret.exists = true
          ret.path = lookup.path
          ret.object = lookup.node
          ret.name = lookup.node.name
          ret.isRoot = lookup.path === '/'
        } catch (e) {
          ret.error = e.errno
        }
        return ret
      },
      createPath(parent, path, canRead, canWrite) {
        parent = typeof parent == 'string' ? parent : FS.getPath(parent)
        var parts = path.split('/').reverse()
        while (parts.length) {
          var part = parts.pop()
          if (!part) continue
          var current = PATH.join2(parent, part)
          try {
            FS.mkdir(current)
          } catch (e) {}
          // ignore EEXIST
          parent = current
        }
        return current
      },
      createFile(parent, name, properties, canRead, canWrite) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name)
        var mode = FS_getMode(canRead, canWrite)
        return FS.create(path, mode)
      },
      createDataFile(parent, name, data, canRead, canWrite, canOwn) {
        var path = name
        if (parent) {
          parent = typeof parent == 'string' ? parent : FS.getPath(parent)
          path = name ? PATH.join2(parent, name) : parent
        }
        var mode = FS_getMode(canRead, canWrite)
        var node = FS.create(path, mode)
        if (data) {
          if (typeof data == 'string') {
            var arr = new Array(data.length)
            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i)
            data = arr
          }
          // make sure we can write to the file
          FS.chmod(node, mode | 146)
          var stream = FS.open(node, 577)
          FS.write(stream, data, 0, data.length, 0, canOwn)
          FS.close(stream)
          FS.chmod(node, mode)
        }
      },
      createDevice(parent, name, input, output) {
        var path = PATH.join2(typeof parent == 'string' ? parent : FS.getPath(parent), name)
        var mode = FS_getMode(!!input, !!output)
        if (!FS.createDevice.major) FS.createDevice.major = 64
        var dev = FS.makedev(FS.createDevice.major++, 0)
        // Create a fake device that a set of stream ops to emulate
        // the old behavior.
        FS.registerDevice(dev, {
          open(stream) {
            stream.seekable = false
          },
          close(stream) {
            // flush any pending line data
            if (output?.buffer?.length) {
              output(10)
            }
          },
          read(stream, buffer, offset, length, pos) {
            /* ignored */ var bytesRead = 0
            for (var i = 0; i < length; i++) {
              var result
              try {
                result = input()
              } catch (e) {
                throw new FS.ErrnoError(29)
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(6)
              }
              if (result === null || result === undefined) break
              bytesRead++
              buffer[offset + i] = result
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now()
            }
            return bytesRead
          },
          write(stream, buffer, offset, length, pos) {
            for (var i = 0; i < length; i++) {
              try {
                output(buffer[offset + i])
              } catch (e) {
                throw new FS.ErrnoError(29)
              }
            }
            if (length) {
              stream.node.timestamp = Date.now()
            }
            return i
          },
        })
        return FS.mkdev(path, mode, dev)
      },
      forceLoadFile(obj) {
        if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true
        if (typeof XMLHttpRequest != 'undefined') {
          throw new Error(
            'Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.'
          )
        } else {
          // Command-line.
          try {
            obj.contents = readBinary(obj.url)
            obj.usedBytes = obj.contents.length
          } catch (e) {
            throw new FS.ErrnoError(29)
          }
        }
      },
      createLazyFile(parent, name, url, canRead, canWrite) {
        // Lazy chunked Uint8Array (implements get and length from Uint8Array).
        // Actual getting is abstracted away for eventual reuse.
        class LazyUint8Array {
          constructor() {
            this.lengthKnown = false
            this.chunks = []
          }
          // Loaded chunks. Index is the chunk number
          get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return undefined
            }
            var chunkOffset = idx % this.chunkSize
            var chunkNum = (idx / this.chunkSize) | 0
            return this.getter(chunkNum)[chunkOffset]
          }
          setDataGetter(getter) {
            this.getter = getter
          }
          cacheLength() {
            // Find length
            var xhr = new XMLHttpRequest()
            xhr.open('HEAD', url, false)
            xhr.send(null)
            if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
              throw new Error("Couldn't load " + url + '. Status: ' + xhr.status)
            var datalength = Number(xhr.getResponseHeader('Content-length'))
            var header
            var hasByteServing =
              (header = xhr.getResponseHeader('Accept-Ranges')) && header === 'bytes'
            var usesGzip = (header = xhr.getResponseHeader('Content-Encoding')) && header === 'gzip'
            var chunkSize = 1024 * 1024
            // Chunk size in bytes
            if (!hasByteServing) chunkSize = datalength
            // Function to get a range from the remote URL.
            var doXHR = (from, to) => {
              if (from > to)
                throw new Error('invalid range (' + from + ', ' + to + ') or no bytes requested!')
              if (to > datalength - 1)
                throw new Error('only ' + datalength + ' bytes available! programmer error!')
              // TODO: Use mozResponseArrayBuffer, responseStream, etc. if available.
              var xhr = new XMLHttpRequest()
              xhr.open('GET', url, false)
              if (datalength !== chunkSize)
                xhr.setRequestHeader('Range', 'bytes=' + from + '-' + to)
              // Some hints to the browser that we want binary data.
              xhr.responseType = 'arraybuffer'
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType('text/plain; charset=x-user-defined')
              }
              xhr.send(null)
              if (!((xhr.status >= 200 && xhr.status < 300) || xhr.status === 304))
                throw new Error("Couldn't load " + url + '. Status: ' + xhr.status)
              if (xhr.response !== undefined) {
                return new Uint8Array(/** @type{Array<number>} */ (xhr.response || []))
              }
              return intArrayFromString(xhr.responseText || '', true)
            }
            var lazyArray = this
            lazyArray.setDataGetter((chunkNum) => {
              var start = chunkNum * chunkSize
              var end = (chunkNum + 1) * chunkSize - 1
              // including this byte
              end = Math.min(end, datalength - 1)
              // if datalength-1 is selected, this is the last block
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') {
                lazyArray.chunks[chunkNum] = doXHR(start, end)
              }
              if (typeof lazyArray.chunks[chunkNum] == 'undefined') throw new Error('doXHR failed!')
              return lazyArray.chunks[chunkNum]
            })
            if (usesGzip || !datalength) {
              // if the server uses gzip or doesn't supply the length, we have to download the whole file to get the (uncompressed) length
              chunkSize = datalength = 1
              // this will force getter(0)/doXHR do download the whole file
              datalength = this.getter(0).length
              chunkSize = datalength
              out('LazyFiles on gzip forces download of the whole file when length is accessed')
            }
            this._length = datalength
            this._chunkSize = chunkSize
            this.lengthKnown = true
          }
          get length() {
            if (!this.lengthKnown) {
              this.cacheLength()
            }
            return this._length
          }
          get chunkSize() {
            if (!this.lengthKnown) {
              this.cacheLength()
            }
            return this._chunkSize
          }
        }
        if (typeof XMLHttpRequest != 'undefined') {
          if (!ENVIRONMENT_IS_WORKER)
            throw 'Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc'
          var lazyArray = new LazyUint8Array()
          var properties = {
            isDevice: false,
            contents: lazyArray,
          }
        } else {
          var properties = {
            isDevice: false,
            url: url,
          }
        }
        var node = FS.createFile(parent, name, properties, canRead, canWrite)
        // This is a total hack, but I want to get this lazy file code out of the
        // core of MEMFS. If we want to keep this lazy file concept I feel it should
        // be its own thin LAZYFS proxying calls to MEMFS.
        if (properties.contents) {
          node.contents = properties.contents
        } else if (properties.url) {
          node.contents = null
          node.url = properties.url
        }
        // Add a function that defers querying the file size until it is asked the first time.
        Object.defineProperties(node, {
          usedBytes: {
            get: function () {
              return this.contents.length
            },
          },
        })
        // override each stream op with one that tries to force load the lazy file first
        var stream_ops = {}
        var keys = Object.keys(node.stream_ops)
        keys.forEach((key) => {
          var fn = node.stream_ops[key]
          stream_ops[key] = (...args) => {
            FS.forceLoadFile(node)
            return fn(...args)
          }
        })
        function writeChunks(stream, buffer, offset, length, position) {
          var contents = stream.node.contents
          if (position >= contents.length) return 0
          var size = Math.min(contents.length - position, length)
          if (contents.slice) {
            // normal array
            for (var i = 0; i < size; i++) {
              buffer[offset + i] = contents[position + i]
            }
          } else {
            for (var i = 0; i < size; i++) {
              // LazyUint8Array from sync binary XHR
              buffer[offset + i] = contents.get(position + i)
            }
          }
          return size
        }
        // use a custom read function
        stream_ops.read = (stream, buffer, offset, length, position) => {
          FS.forceLoadFile(node)
          return writeChunks(stream, buffer, offset, length, position)
        }
        // use a custom mmap function
        stream_ops.mmap = (stream, length, position, prot, flags) => {
          FS.forceLoadFile(node)
          var ptr = mmapAlloc(length)
          if (!ptr) {
            throw new FS.ErrnoError(48)
          }
          writeChunks(stream, GROWABLE_HEAP_I8(), ptr, length, position)
          return {
            ptr: ptr,
            allocated: true,
          }
        }
        node.stream_ops = stream_ops
        return node
      },
    }

    var SYSCALLS = {
      DEFAULT_POLLMASK: 5,
      calculateAt(dirfd, path, allowEmpty) {
        if (PATH.isAbs(path)) {
          return path
        }
        // relative path
        var dir
        if (dirfd === -100) {
          dir = FS.cwd()
        } else {
          var dirstream = SYSCALLS.getStreamFromFD(dirfd)
          dir = dirstream.path
        }
        if (path.length == 0) {
          if (!allowEmpty) {
            throw new FS.ErrnoError(44)
          }
          return dir
        }
        return PATH.join2(dir, path)
      },
      doStat(func, path, buf) {
        var stat = func(path)
        GROWABLE_HEAP_I32()[buf >> 2] = stat.dev
        GROWABLE_HEAP_I32()[(buf + 4) >> 2] = stat.mode
        GROWABLE_HEAP_U32()[(buf + 8) >> 2] = stat.nlink
        GROWABLE_HEAP_I32()[(buf + 12) >> 2] = stat.uid
        GROWABLE_HEAP_I32()[(buf + 16) >> 2] = stat.gid
        GROWABLE_HEAP_I32()[(buf + 20) >> 2] = stat.rdev
        ;(tempI64 = [
          stat.size >>> 0,
          ((tempDouble = stat.size),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
            : 0),
        ]),
          (GROWABLE_HEAP_I32()[(buf + 24) >> 2] = tempI64[0]),
          (GROWABLE_HEAP_I32()[(buf + 28) >> 2] = tempI64[1])
        GROWABLE_HEAP_I32()[(buf + 32) >> 2] = 4096
        GROWABLE_HEAP_I32()[(buf + 36) >> 2] = stat.blocks
        var atime = stat.atime.getTime()
        var mtime = stat.mtime.getTime()
        var ctime = stat.ctime.getTime()
        ;(tempI64 = [
          Math.floor(atime / 1e3) >>> 0,
          ((tempDouble = Math.floor(atime / 1e3)),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
            : 0),
        ]),
          (GROWABLE_HEAP_I32()[(buf + 40) >> 2] = tempI64[0]),
          (GROWABLE_HEAP_I32()[(buf + 44) >> 2] = tempI64[1])
        GROWABLE_HEAP_U32()[(buf + 48) >> 2] = (atime % 1e3) * 1e3
        ;(tempI64 = [
          Math.floor(mtime / 1e3) >>> 0,
          ((tempDouble = Math.floor(mtime / 1e3)),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
            : 0),
        ]),
          (GROWABLE_HEAP_I32()[(buf + 56) >> 2] = tempI64[0]),
          (GROWABLE_HEAP_I32()[(buf + 60) >> 2] = tempI64[1])
        GROWABLE_HEAP_U32()[(buf + 64) >> 2] = (mtime % 1e3) * 1e3
        ;(tempI64 = [
          Math.floor(ctime / 1e3) >>> 0,
          ((tempDouble = Math.floor(ctime / 1e3)),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
            : 0),
        ]),
          (GROWABLE_HEAP_I32()[(buf + 72) >> 2] = tempI64[0]),
          (GROWABLE_HEAP_I32()[(buf + 76) >> 2] = tempI64[1])
        GROWABLE_HEAP_U32()[(buf + 80) >> 2] = (ctime % 1e3) * 1e3
        ;(tempI64 = [
          stat.ino >>> 0,
          ((tempDouble = stat.ino),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
            : 0),
        ]),
          (GROWABLE_HEAP_I32()[(buf + 88) >> 2] = tempI64[0]),
          (GROWABLE_HEAP_I32()[(buf + 92) >> 2] = tempI64[1])
        return 0
      },
      doMsync(addr, stream, len, flags, offset) {
        if (!FS.isFile(stream.node.mode)) {
          throw new FS.ErrnoError(43)
        }
        if (flags & 2) {
          // MAP_PRIVATE calls need not to be synced back to underlying fs
          return 0
        }
        var buffer = GROWABLE_HEAP_U8().slice(addr, addr + len)
        FS.msync(stream, buffer, offset, len, flags)
      },
      getStreamFromFD(fd) {
        var stream = FS.getStreamChecked(fd)
        return stream
      },
      varargs: undefined,
      getStr(ptr) {
        var ret = UTF8ToString(ptr)
        return ret
      },
    }

    function ___syscall_faccessat(dirfd, path, amode, flags) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(3, 0, 1, dirfd, path, amode, flags)
      try {
        path = SYSCALLS.getStr(path)
        path = SYSCALLS.calculateAt(dirfd, path)
        if (amode & ~7) {
          // need a valid mode
          return -28
        }
        var lookup = FS.lookupPath(path, {
          follow: true,
        })
        var node = lookup.node
        if (!node) {
          return -44
        }
        var perms = ''
        if (amode & 4) perms += 'r'
        if (amode & 2) perms += 'w'
        if (amode & 1) perms += 'x'
        if (perms && /* otherwise, they've just passed F_OK */ FS.nodePermissions(node, perms)) {
          return -2
        }
        return 0
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return -e.errno
      }
    }

    /** @suppress {duplicate } */ function syscallGetVarargI() {
      // the `+` prepended here is necessary to convince the JSCompiler that varargs is indeed a number.
      var ret = GROWABLE_HEAP_I32()[+SYSCALLS.varargs >> 2]
      SYSCALLS.varargs += 4
      return ret
    }

    var syscallGetVarargP = syscallGetVarargI

    function ___syscall_fcntl64(fd, cmd, varargs) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(4, 0, 1, fd, cmd, varargs)
      SYSCALLS.varargs = varargs
      try {
        var stream = SYSCALLS.getStreamFromFD(fd)
        switch (cmd) {
          case 0: {
            var arg = syscallGetVarargI()
            if (arg < 0) {
              return -28
            }
            while (FS.streams[arg]) {
              arg++
            }
            var newStream
            newStream = FS.dupStream(stream, arg)
            return newStream.fd
          }

          case 1:
          case 2:
            return 0

          // FD_CLOEXEC makes no sense for a single process.
          case 3:
            return stream.flags

          case 4: {
            var arg = syscallGetVarargI()
            stream.flags |= arg
            return 0
          }

          case 12: {
            var arg = syscallGetVarargP()
            var offset = 0
            // We're always unlocked.
            GROWABLE_HEAP_I16()[(arg + offset) >> 1] = 2
            return 0
          }

          case 13:
          case 14:
            return 0
        }
        // Pretend that the locking is successful.
        return -28
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return -e.errno
      }
    }

    var stringToUTF8 = (str, outPtr, maxBytesToWrite) =>
      stringToUTF8Array(str, GROWABLE_HEAP_U8(), outPtr, maxBytesToWrite)

    function ___syscall_getcwd(buf, size) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(5, 0, 1, buf, size)
      try {
        if (size === 0) return -28
        var cwd = FS.cwd()
        var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1
        if (size < cwdLengthInBytes) return -68
        stringToUTF8(cwd, buf, size)
        return cwdLengthInBytes
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return -e.errno
      }
    }

    function ___syscall_ioctl(fd, op, varargs) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(6, 0, 1, fd, op, varargs)
      SYSCALLS.varargs = varargs
      try {
        var stream = SYSCALLS.getStreamFromFD(fd)
        switch (op) {
          case 21509: {
            if (!stream.tty) return -59
            return 0
          }

          case 21505: {
            if (!stream.tty) return -59
            if (stream.tty.ops.ioctl_tcgets) {
              var termios = stream.tty.ops.ioctl_tcgets(stream)
              var argp = syscallGetVarargP()
              GROWABLE_HEAP_I32()[argp >> 2] = termios.c_iflag || 0
              GROWABLE_HEAP_I32()[(argp + 4) >> 2] = termios.c_oflag || 0
              GROWABLE_HEAP_I32()[(argp + 8) >> 2] = termios.c_cflag || 0
              GROWABLE_HEAP_I32()[(argp + 12) >> 2] = termios.c_lflag || 0
              for (var i = 0; i < 32; i++) {
                GROWABLE_HEAP_I8()[argp + i + 17] = termios.c_cc[i] || 0
              }
              return 0
            }
            return 0
          }

          case 21510:
          case 21511:
          case 21512: {
            if (!stream.tty) return -59
            return 0
          }

          // no-op, not actually adjusting terminal settings
          case 21506:
          case 21507:
          case 21508: {
            if (!stream.tty) return -59
            if (stream.tty.ops.ioctl_tcsets) {
              var argp = syscallGetVarargP()
              var c_iflag = GROWABLE_HEAP_I32()[argp >> 2]
              var c_oflag = GROWABLE_HEAP_I32()[(argp + 4) >> 2]
              var c_cflag = GROWABLE_HEAP_I32()[(argp + 8) >> 2]
              var c_lflag = GROWABLE_HEAP_I32()[(argp + 12) >> 2]
              var c_cc = []
              for (var i = 0; i < 32; i++) {
                c_cc.push(GROWABLE_HEAP_I8()[argp + i + 17])
              }
              return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                c_iflag: c_iflag,
                c_oflag: c_oflag,
                c_cflag: c_cflag,
                c_lflag: c_lflag,
                c_cc: c_cc,
              })
            }
            return 0
          }

          // no-op, not actually adjusting terminal settings
          case 21519: {
            if (!stream.tty) return -59
            var argp = syscallGetVarargP()
            GROWABLE_HEAP_I32()[argp >> 2] = 0
            return 0
          }

          case 21520: {
            if (!stream.tty) return -59
            return -28
          }

          // not supported
          case 21531: {
            var argp = syscallGetVarargP()
            return FS.ioctl(stream, op, argp)
          }

          case 21523: {
            // TODO: in theory we should write to the winsize struct that gets
            // passed in, but for now musl doesn't read anything on it
            if (!stream.tty) return -59
            if (stream.tty.ops.ioctl_tiocgwinsz) {
              var winsize = stream.tty.ops.ioctl_tiocgwinsz(stream.tty)
              var argp = syscallGetVarargP()
              GROWABLE_HEAP_I16()[argp >> 1] = winsize[0]
              GROWABLE_HEAP_I16()[(argp + 2) >> 1] = winsize[1]
            }
            return 0
          }

          case 21524: {
            // TODO: technically, this ioctl call should change the window size.
            // but, since emscripten doesn't have any concept of a terminal window
            // yet, we'll just silently throw it away as we do TIOCGWINSZ
            if (!stream.tty) return -59
            return 0
          }

          case 21515: {
            if (!stream.tty) return -59
            return 0
          }

          default:
            return -28
        }
      } catch (e) {
        // not supported
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return -e.errno
      }
    }

    function ___syscall_openat(dirfd, path, flags, varargs) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(7, 0, 1, dirfd, path, flags, varargs)
      SYSCALLS.varargs = varargs
      try {
        path = SYSCALLS.getStr(path)
        path = SYSCALLS.calculateAt(dirfd, path)
        var mode = varargs ? syscallGetVarargI() : 0
        return FS.open(path, flags, mode).fd
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return -e.errno
      }
    }

    var __emscripten_fs_load_embedded_files = (ptr) => {
      do {
        var name_addr = GROWABLE_HEAP_U32()[ptr >> 2]
        ptr += 4
        var len = GROWABLE_HEAP_U32()[ptr >> 2]
        ptr += 4
        var content = GROWABLE_HEAP_U32()[ptr >> 2]
        ptr += 4
        var name = UTF8ToString(name_addr)
        FS.createPath('/', PATH.dirname(name), true, true)
        // canOwn this data in the filesystem, it is a slice of wasm memory that will never change
        FS.createDataFile(
          name,
          null,
          GROWABLE_HEAP_I8().subarray(content, content + len),
          true,
          true,
          true
        )
      } while (GROWABLE_HEAP_U32()[ptr >> 2])
    }

    var nowIsMonotonic = 1

    var __emscripten_get_now_is_monotonic = () => nowIsMonotonic

    var __emscripten_init_main_thread_js = (tb) => {
      // Pass the thread address to the native code where they stored in wasm
      // globals which act as a form of TLS. Global constructors trying
      // to access this value will read the wrong value, but that is UB anyway.
      __emscripten_thread_init(
        tb,
        /*is_main=*/ !ENVIRONMENT_IS_WORKER,
        /*is_runtime=*/ 1,
        /*can_block=*/ !ENVIRONMENT_IS_WEB,
        /*default_stacksize=*/ 65536,
        /*start_profiling=*/ false
      )
      PThread.threadInitTLS()
    }

    var maybeExit = () => {
      if (runtimeExited) {
        return
      }
      if (!keepRuntimeAlive()) {
        try {
          if (ENVIRONMENT_IS_PTHREAD) __emscripten_thread_exit(EXITSTATUS)
          else _exit(EXITSTATUS)
        } catch (e) {
          handleException(e)
        }
      }
    }

    var callUserCallback = (func) => {
      if (runtimeExited || ABORT) {
        return
      }
      try {
        func()
        maybeExit()
      } catch (e) {
        handleException(e)
      }
    }

    var __emscripten_thread_mailbox_await = (pthread_ptr) => {
      if (typeof Atomics.waitAsync === 'function') {
        // Wait on the pthread's initial self-pointer field because it is easy and
        // safe to access from sending threads that need to notify the waiting
        // thread.
        // TODO: How to make this work with wasm64?
        var wait = Atomics.waitAsync(GROWABLE_HEAP_I32(), pthread_ptr >> 2, pthread_ptr)
        wait.value.then(checkMailbox)
        var waitingAsync = pthread_ptr + 128
        Atomics.store(GROWABLE_HEAP_I32(), waitingAsync >> 2, 1)
      }
    }

    // If `Atomics.waitAsync` is not implemented, then we will always fall back
    // to postMessage and there is no need to do anything here.
    var checkMailbox = () => {
      // Only check the mailbox if we have a live pthread runtime. We implement
      // pthread_self to return 0 if there is no live runtime.
      var pthread_ptr = _pthread_self()
      if (pthread_ptr) {
        // If we are using Atomics.waitAsync as our notification mechanism, wait
        // for a notification before processing the mailbox to avoid missing any
        // work that could otherwise arrive after we've finished processing the
        // mailbox and before we're ready for the next notification.
        __emscripten_thread_mailbox_await(pthread_ptr)
        callUserCallback(__emscripten_check_mailbox)
      }
    }

    var __emscripten_notify_mailbox_postmessage = (targetThreadId, currThreadId, mainThreadId) => {
      if (targetThreadId == currThreadId) {
        setTimeout(checkMailbox)
      } else if (ENVIRONMENT_IS_PTHREAD) {
        postMessage({
          targetThread: targetThreadId,
          cmd: 'checkMailbox',
        })
      } else {
        var worker = PThread.pthreads[targetThreadId]
        if (!worker) {
          return
        }
        worker.postMessage({
          cmd: 'checkMailbox',
        })
      }
    }

    var proxiedJSCallArgs = []

    var __emscripten_receive_on_main_thread_js = (
      funcIndex,
      emAsmAddr,
      callingThread,
      numCallArgs,
      args
    ) => {
      // Sometimes we need to backproxy events to the calling thread (e.g.
      // HTML5 DOM events handlers such as
      // emscripten_set_mousemove_callback()), so keep track in a globally
      // accessible variable about the thread that initiated the proxying.
      proxiedJSCallArgs.length = numCallArgs
      var b = args >> 3
      for (var i = 0; i < numCallArgs; i++) {
        proxiedJSCallArgs[i] = GROWABLE_HEAP_F64()[b + i]
      }
      // Proxied JS library funcs use funcIndex and EM_ASM functions use emAsmAddr
      var func = emAsmAddr ? ASM_CONSTS[emAsmAddr] : proxiedFunctionTable[funcIndex]
      PThread.currentProxiedOperationCallerThread = callingThread
      var rtn = func(...proxiedJSCallArgs)
      PThread.currentProxiedOperationCallerThread = 0
      return rtn
    }

    var __emscripten_thread_cleanup = (thread) => {
      // Called when a thread needs to be cleaned up so it can be reused.
      // A thread is considered reusable when it either returns from its
      // entry point, calls pthread_exit, or acts upon a cancellation.
      // Detached threads are responsible for calling this themselves,
      // otherwise pthread_join is responsible for calling this.
      if (!ENVIRONMENT_IS_PTHREAD) cleanupThread(thread)
      else
        postMessage({
          cmd: 'cleanupThread',
          thread: thread,
        })
    }

    var __emscripten_thread_set_strongref = (thread) => {}

    // Called when a thread needs to be strongly referenced.
    // Currently only used for:
    // - keeping the "main" thread alive in PROXY_TO_PTHREAD mode;
    // - crashed threads that needs to propagate the uncaught exception
    //   back to the main thread.
    var readEmAsmArgsArray = []

    var readEmAsmArgs = (sigPtr, buf) => {
      readEmAsmArgsArray.length = 0
      var ch
      // Most arguments are i32s, so shift the buffer pointer so it is a plain
      // index into HEAP32.
      while ((ch = GROWABLE_HEAP_U8()[sigPtr++])) {
        // Floats are always passed as doubles, so all types except for 'i'
        // are 8 bytes and require alignment.
        var wide = ch != 105
        wide &= ch != 112
        buf += wide && buf % 8 ? 4 : 0
        readEmAsmArgsArray.push(
          // Special case for pointers under wasm64 or CAN_ADDRESS_2GB mode.
          ch == 112
            ? GROWABLE_HEAP_U32()[buf >> 2]
            : ch == 105
              ? GROWABLE_HEAP_I32()[buf >> 2]
              : GROWABLE_HEAP_F64()[buf >> 3]
        )
        buf += wide ? 8 : 4
      }
      return readEmAsmArgsArray
    }

    var runEmAsmFunction = (code, sigPtr, argbuf) => {
      var args = readEmAsmArgs(sigPtr, argbuf)
      return ASM_CONSTS[code](...args)
    }

    var _emscripten_asm_const_int = (code, sigPtr, argbuf) => runEmAsmFunction(code, sigPtr, argbuf)

    var warnOnce = (text) => {
      warnOnce.shown ||= {}
      if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1
        err(text)
      }
    }

    var _emscripten_check_blocking_allowed = () => {}

    var _emscripten_date_now = () => Date.now()

    var runtimeKeepalivePush = () => {
      runtimeKeepaliveCounter += 1
    }

    var _emscripten_exit_with_live_runtime = () => {
      runtimeKeepalivePush()
      throw 'unwind'
    }

    function __emscripten_runtime_keepalive_clear() {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(9, 0, 1)
      noExitRuntime = false
      runtimeKeepaliveCounter = 0
    }

    function _emscripten_force_exit(status) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(8, 0, 1, status)
      __emscripten_runtime_keepalive_clear()
      _exit(status)
    }

    var JSEvents = {
      removeAllEventListeners() {
        while (JSEvents.eventHandlers.length) {
          JSEvents._removeHandler(JSEvents.eventHandlers.length - 1)
        }
        JSEvents.deferredCalls = []
      },
      registerRemoveEventListeners() {
        if (!JSEvents.removeEventListenersRegistered) {
          __ATEXIT__.push(JSEvents.removeAllEventListeners)
          JSEvents.removeEventListenersRegistered = true
        }
      },
      inEventHandler: 0,
      deferredCalls: [],
      deferCall(targetFunction, precedence, argsList) {
        function arraysHaveEqualContent(arrA, arrB) {
          if (arrA.length != arrB.length) return false
          for (var i in arrA) {
            if (arrA[i] != arrB[i]) return false
          }
          return true
        }
        // Test if the given call was already queued, and if so, don't add it again.
        for (var i in JSEvents.deferredCalls) {
          var call = JSEvents.deferredCalls[i]
          if (
            call.targetFunction == targetFunction &&
            arraysHaveEqualContent(call.argsList, argsList)
          ) {
            return
          }
        }
        JSEvents.deferredCalls.push({
          targetFunction: targetFunction,
          precedence: precedence,
          argsList: argsList,
        })
        JSEvents.deferredCalls.sort((x, y) => x.precedence < y.precedence)
      },
      removeDeferredCalls(targetFunction) {
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          if (JSEvents.deferredCalls[i].targetFunction == targetFunction) {
            JSEvents.deferredCalls.splice(i, 1)
            --i
          }
        }
      },
      canPerformEventHandlerRequests() {
        if (navigator.userActivation) {
          // Verify against transient activation status from UserActivation API
          // whether it is possible to perform a request here without needing to defer. See
          // https://developer.mozilla.org/en-US/docs/Web/Security/User_activation#transient_activation
          // and https://caniuse.com/mdn-api_useractivation
          // At the time of writing, Firefox does not support this API: https://bugzilla.mozilla.org/show_bug.cgi?id=1791079
          return navigator.userActivation.isActive
        }
        return JSEvents.inEventHandler && JSEvents.currentEventHandler.allowsDeferredCalls
      },
      runDeferredCalls() {
        if (!JSEvents.canPerformEventHandlerRequests()) {
          return
        }
        for (var i = 0; i < JSEvents.deferredCalls.length; ++i) {
          var call = JSEvents.deferredCalls[i]
          JSEvents.deferredCalls.splice(i, 1)
          --i
          call.targetFunction(...call.argsList)
        }
      },
      eventHandlers: [],
      removeAllHandlersOnTarget: (target, eventTypeString) => {
        for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
          if (
            JSEvents.eventHandlers[i].target == target &&
            (!eventTypeString || eventTypeString == JSEvents.eventHandlers[i].eventTypeString)
          ) {
            JSEvents._removeHandler(i--)
          }
        }
      },
      _removeHandler(i) {
        var h = JSEvents.eventHandlers[i]
        h.target.removeEventListener(h.eventTypeString, h.eventListenerFunc, h.useCapture)
        JSEvents.eventHandlers.splice(i, 1)
      },
      registerOrRemoveHandler(eventHandler) {
        if (!eventHandler.target) {
          return -4
        }
        if (eventHandler.callbackfunc) {
          eventHandler.eventListenerFunc = function (event) {
            // Increment nesting count for the event handler.
            ++JSEvents.inEventHandler
            JSEvents.currentEventHandler = eventHandler
            // Process any old deferred calls the user has placed.
            JSEvents.runDeferredCalls()
            // Process the actual event, calls back to user C code handler.
            eventHandler.handlerFunc(event)
            // Process any new deferred calls that were placed right now from this event handler.
            JSEvents.runDeferredCalls()
            // Out of event handler - restore nesting count.
            --JSEvents.inEventHandler
          }
          eventHandler.target.addEventListener(
            eventHandler.eventTypeString,
            eventHandler.eventListenerFunc,
            eventHandler.useCapture
          )
          JSEvents.eventHandlers.push(eventHandler)
          JSEvents.registerRemoveEventListeners()
        } else {
          for (var i = 0; i < JSEvents.eventHandlers.length; ++i) {
            if (
              JSEvents.eventHandlers[i].target == eventHandler.target &&
              JSEvents.eventHandlers[i].eventTypeString == eventHandler.eventTypeString
            ) {
              JSEvents._removeHandler(i--)
            }
          }
        }
        return 0
      },
      getTargetThreadForEventCallback(targetThread) {
        switch (targetThread) {
          case 1:
            // The event callback for the current event should be called on the
            // main browser thread. (0 == don't proxy)
            return 0

          case 2:
            // The event callback for the current event should be backproxied to
            // the thread that is registering the event.
            // This can be 0 in the case that the caller uses
            // EM_CALLBACK_THREAD_CONTEXT_CALLING_THREAD but on the main thread
            // itself.
            return PThread.currentProxiedOperationCallerThread

          default:
            // The event callback for the current event should be proxied to the
            // given specific thread.
            return targetThread
        }
      },
      getNodeNameForTarget(target) {
        if (!target) return ''
        if (target == window) return '#window'
        if (target == screen) return '#screen'
        return target?.nodeName || ''
      },
      fullscreenEnabled() {
        return (
          document.fullscreenEnabled || // Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitFullscreenEnabled.
          // TODO: If Safari at some point ships with unprefixed version, update the version check above.
          document.webkitFullscreenEnabled
        )
      },
    }

    var maybeCStringToJsString = (cString) => (cString > 2 ? UTF8ToString(cString) : cString)

    /** @type {Object} */ var specialHTMLTargets = [
      0,
      typeof document != 'undefined' ? document : 0,
      typeof window != 'undefined' ? window : 0,
    ]

    var findEventTarget = (target) => {
      target = maybeCStringToJsString(target)
      var domElement =
        specialHTMLTargets[target] ||
        (typeof document != 'undefined' ? document.querySelector(target) : undefined)
      return domElement
    }

    var getBoundingClientRect = (e) =>
      specialHTMLTargets.indexOf(e) < 0
        ? e.getBoundingClientRect()
        : {
            left: 0,
            top: 0,
          }

    function _emscripten_get_element_css_size(target, width, height) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(10, 0, 1, target, width, height)
      target = findEventTarget(target)
      if (!target) return -4
      var rect = getBoundingClientRect(target)
      GROWABLE_HEAP_F64()[width >> 3] = rect.width
      GROWABLE_HEAP_F64()[height >> 3] = rect.height
      return 0
    }

    var fillGamepadEventData = (eventStruct, e) => {
      GROWABLE_HEAP_F64()[eventStruct >> 3] = e.timestamp
      for (var i = 0; i < e.axes.length; ++i) {
        GROWABLE_HEAP_F64()[(eventStruct + i * 8 + 16) >> 3] = e.axes[i]
      }
      for (var i = 0; i < e.buttons.length; ++i) {
        if (typeof e.buttons[i] == 'object') {
          GROWABLE_HEAP_F64()[(eventStruct + i * 8 + 528) >> 3] = e.buttons[i].value
        } else {
          GROWABLE_HEAP_F64()[(eventStruct + i * 8 + 528) >> 3] = e.buttons[i]
        }
      }
      for (var i = 0; i < e.buttons.length; ++i) {
        if (typeof e.buttons[i] == 'object') {
          GROWABLE_HEAP_I8()[eventStruct + i + 1040] = e.buttons[i].pressed
        } else {
          // Assigning a boolean to HEAP32, that's ok, but Closure would like to warn about it:
          /** @suppress {checkTypes} */ GROWABLE_HEAP_I8()[eventStruct + i + 1040] =
            e.buttons[i] == 1
        }
      }
      GROWABLE_HEAP_I8()[eventStruct + 1104] = e.connected
      GROWABLE_HEAP_I32()[(eventStruct + 1108) >> 2] = e.index
      GROWABLE_HEAP_I32()[(eventStruct + 8) >> 2] = e.axes.length
      GROWABLE_HEAP_I32()[(eventStruct + 12) >> 2] = e.buttons.length
      stringToUTF8(e.id, eventStruct + 1112, 64)
      stringToUTF8(e.mapping, eventStruct + 1176, 64)
    }

    function _emscripten_get_gamepad_status(index, gamepadState) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(11, 0, 1, index, gamepadState)
      // INVALID_PARAM is returned on a Gamepad index that never was there.
      if (index < 0 || index >= JSEvents.lastGamepadState.length) return -5
      // NO_DATA is returned on a Gamepad index that was removed.
      // For previously disconnected gamepads there should be an empty slot (null/undefined/false) at the index.
      // This is because gamepads must keep their original position in the array.
      // For example, removing the first of two gamepads produces [null/undefined/false, gamepad].
      if (!JSEvents.lastGamepadState[index]) return -7
      fillGamepadEventData(gamepadState, JSEvents.lastGamepadState[index])
      return 0
    }

    var _emscripten_get_now

    // Pthreads need their clocks synchronized to the execution of the main
    // thread, so, when using them, make sure to adjust all timings to the
    // respective time origins.
    _emscripten_get_now = () => performance.timeOrigin + performance.now()

    function _emscripten_get_num_gamepads() {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(12, 0, 1)
      // N.B. Do not call emscripten_get_num_gamepads() unless having first called emscripten_sample_gamepad_data(), and that has returned EMSCRIPTEN_RESULT_SUCCESS.
      // Otherwise the following line will throw an exception.
      return JSEvents.lastGamepadState.length
    }

    var webgl_enable_ANGLE_instanced_arrays = (ctx) => {
      // Extension available in WebGL 1 from Firefox 26 and Google Chrome 30 onwards. Core feature in WebGL 2.
      var ext = ctx.getExtension('ANGLE_instanced_arrays')
      if (ext) {
        ctx['vertexAttribDivisor'] = (index, divisor) =>
          ext['vertexAttribDivisorANGLE'](index, divisor)
        ctx['drawArraysInstanced'] = (mode, first, count, primcount) =>
          ext['drawArraysInstancedANGLE'](mode, first, count, primcount)
        ctx['drawElementsInstanced'] = (mode, count, type, indices, primcount) =>
          ext['drawElementsInstancedANGLE'](mode, count, type, indices, primcount)
        return 1
      }
    }

    var webgl_enable_OES_vertex_array_object = (ctx) => {
      // Extension available in WebGL 1 from Firefox 25 and WebKit 536.28/desktop Safari 6.0.3 onwards. Core feature in WebGL 2.
      var ext = ctx.getExtension('OES_vertex_array_object')
      if (ext) {
        ctx['createVertexArray'] = () => ext['createVertexArrayOES']()
        ctx['deleteVertexArray'] = (vao) => ext['deleteVertexArrayOES'](vao)
        ctx['bindVertexArray'] = (vao) => ext['bindVertexArrayOES'](vao)
        ctx['isVertexArray'] = (vao) => ext['isVertexArrayOES'](vao)
        return 1
      }
    }

    var webgl_enable_WEBGL_draw_buffers = (ctx) => {
      // Extension available in WebGL 1 from Firefox 28 onwards. Core feature in WebGL 2.
      var ext = ctx.getExtension('WEBGL_draw_buffers')
      if (ext) {
        ctx['drawBuffers'] = (n, bufs) => ext['drawBuffersWEBGL'](n, bufs)
        return 1
      }
    }

    var webgl_enable_WEBGL_multi_draw = (ctx) =>
      !!(ctx.multiDrawWebgl = ctx.getExtension('WEBGL_multi_draw'))

    var getEmscriptenSupportedExtensions = (ctx) => {
      // Restrict the list of advertised extensions to those that we actually
      // support.
      var supportedExtensions = [
        // WebGL 1 extensions
        'ANGLE_instanced_arrays',
        'EXT_blend_minmax',
        'EXT_disjoint_timer_query',
        'EXT_frag_depth',
        'EXT_shader_texture_lod',
        'EXT_sRGB',
        'OES_element_index_uint',
        'OES_fbo_render_mipmap',
        'OES_standard_derivatives',
        'OES_texture_float',
        'OES_texture_half_float',
        'OES_texture_half_float_linear',
        'OES_vertex_array_object',
        'WEBGL_color_buffer_float',
        'WEBGL_depth_texture',
        'WEBGL_draw_buffers', // WebGL 1 and WebGL 2 extensions
        'EXT_color_buffer_half_float',
        'EXT_depth_clamp',
        'EXT_float_blend',
        'EXT_texture_compression_bptc',
        'EXT_texture_compression_rgtc',
        'EXT_texture_filter_anisotropic',
        'KHR_parallel_shader_compile',
        'OES_texture_float_linear',
        'WEBGL_blend_func_extended',
        'WEBGL_compressed_texture_astc',
        'WEBGL_compressed_texture_etc',
        'WEBGL_compressed_texture_etc1',
        'WEBGL_compressed_texture_s3tc',
        'WEBGL_compressed_texture_s3tc_srgb',
        'WEBGL_debug_renderer_info',
        'WEBGL_debug_shaders',
        'WEBGL_lose_context',
        'WEBGL_multi_draw',
      ]
      // .getSupportedExtensions() can return null if context is lost, so coerce to empty array.
      return (ctx.getSupportedExtensions() || []).filter((ext) => supportedExtensions.includes(ext))
    }

    var GL = {
      counter: 1,
      buffers: [],
      programs: [],
      framebuffers: [],
      renderbuffers: [],
      textures: [],
      shaders: [],
      vaos: [],
      contexts: {},
      offscreenCanvases: {},
      queries: [],
      stringCache: {},
      unpackAlignment: 4,
      unpackRowLength: 0,
      recordError: (errorCode) => {
        if (!GL.lastError) {
          GL.lastError = errorCode
        }
      },
      getNewId: (table) => {
        var ret = GL.counter++
        for (var i = table.length; i < ret; i++) {
          table[i] = null
        }
        return ret
      },
      genObject: (n, buffers, createFunction, objectTable) => {
        for (var i = 0; i < n; i++) {
          var buffer = GLctx[createFunction]()
          var id = buffer && GL.getNewId(objectTable)
          if (buffer) {
            buffer.name = id
            objectTable[id] = buffer
          } else {
            GL.recordError(1282)
          }
          GROWABLE_HEAP_I32()[(buffers + i * 4) >> 2] = id
        }
      },
      getSource: (shader, count, string, length) => {
        var source = ''
        for (var i = 0; i < count; ++i) {
          var len = length ? GROWABLE_HEAP_U32()[(length + i * 4) >> 2] : undefined
          source += UTF8ToString(GROWABLE_HEAP_U32()[(string + i * 4) >> 2], len)
        }
        return source
      },
      createContext: (/** @type {HTMLCanvasElement} */ canvas, webGLContextAttributes) => {
        // BUG: Workaround Safari WebGL issue: After successfully acquiring WebGL
        // context on a canvas, calling .getContext() will always return that
        // context independent of which 'webgl' or 'webgl2'
        // context version was passed. See:
        //   https://bugs.webkit.org/show_bug.cgi?id=222758
        // and:
        //   https://github.com/emscripten-core/emscripten/issues/13295.
        // TODO: Once the bug is fixed and shipped in Safari, adjust the Safari
        // version field in above check.
        if (!canvas.getContextSafariWebGL2Fixed) {
          canvas.getContextSafariWebGL2Fixed = canvas.getContext
          /** @type {function(this:HTMLCanvasElement, string, (Object|null)=): (Object|null)} */ function fixedGetContext(
            ver,
            attrs
          ) {
            var gl = canvas.getContextSafariWebGL2Fixed(ver, attrs)
            return (ver == 'webgl') == gl instanceof WebGLRenderingContext ? gl : null
          }
          canvas.getContext = fixedGetContext
        }
        var ctx = canvas.getContext('webgl', webGLContextAttributes)
        // https://caniuse.com/#feat=webgl
        if (!ctx) return 0
        var handle = GL.registerContext(ctx, webGLContextAttributes)
        return handle
      },
      registerContext: (ctx, webGLContextAttributes) => {
        // with pthreads a context is a location in memory with some synchronized
        // data between threads
        var handle = _malloc(8)
        GROWABLE_HEAP_U32()[(handle + 4) >> 2] = _pthread_self()
        // the thread pointer of the thread that owns the control of the context
        var context = {
          handle: handle,
          attributes: webGLContextAttributes,
          version: webGLContextAttributes.majorVersion,
          GLctx: ctx,
        }
        // Store the created context object so that we can access the context
        // given a canvas without having to pass the parameters again.
        if (ctx.canvas) ctx.canvas.GLctxObject = context
        GL.contexts[handle] = context
        if (
          typeof webGLContextAttributes.enableExtensionsByDefault == 'undefined' ||
          webGLContextAttributes.enableExtensionsByDefault
        ) {
          GL.initExtensions(context)
        }
        return handle
      },
      makeContextCurrent: (contextHandle) => {
        // Active Emscripten GL layer context object.
        GL.currentContext = GL.contexts[contextHandle]
        // Active WebGL context object.
        Module.ctx = GLctx = GL.currentContext?.GLctx
        return !(contextHandle && !GLctx)
      },
      getContext: (contextHandle) => GL.contexts[contextHandle],
      deleteContext: (contextHandle) => {
        if (GL.currentContext === GL.contexts[contextHandle]) {
          GL.currentContext = null
        }
        if (typeof JSEvents == 'object') {
          // Release all JS event handlers on the DOM element that the GL context is
          // associated with since the context is now deleted.
          JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas)
        }
        // Make sure the canvas object no longer refers to the context object so
        // there are no GC surprises.
        if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) {
          GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined
        }
        _free(GL.contexts[contextHandle].handle)
        GL.contexts[contextHandle] = null
      },
      initExtensions: (context) => {
        // If this function is called without a specific context object, init the
        // extensions of the currently active context.
        context ||= GL.currentContext
        if (context.initExtensionsDone) return
        context.initExtensionsDone = true
        var GLctx = context.GLctx
        // Detect the presence of a few extensions manually, ction GL interop
        // layer itself will need to know if they exist.
        // Extensions that are only available in WebGL 1 (the calls will be no-ops
        // if called on a WebGL 2 context active)
        webgl_enable_ANGLE_instanced_arrays(GLctx)
        webgl_enable_OES_vertex_array_object(GLctx)
        webgl_enable_WEBGL_draw_buffers(GLctx)
        {
          GLctx.disjointTimerQueryExt = GLctx.getExtension('EXT_disjoint_timer_query')
        }
        webgl_enable_WEBGL_multi_draw(GLctx)
        getEmscriptenSupportedExtensions(GLctx).forEach((ext) => {
          // WEBGL_lose_context, WEBGL_debug_renderer_info and WEBGL_debug_shaders
          // are not enabled by default.
          if (!ext.includes('lose_context') && !ext.includes('debug')) {
            // Call .getExtension() to enable that extension permanently.
            GLctx.getExtension(ext)
          }
        })
      },
    }

    /** @suppress {duplicate } */ var _glActiveTexture = (x0) => GLctx.activeTexture(x0)

    var _emscripten_glActiveTexture = _glActiveTexture

    /** @suppress {duplicate } */ var _glAttachShader = (program, shader) => {
      GLctx.attachShader(GL.programs[program], GL.shaders[shader])
    }

    var _emscripten_glAttachShader = _glAttachShader

    /** @suppress {duplicate } */ var _glBeginQueryEXT = (target, id) => {
      GLctx.disjointTimerQueryExt['beginQueryEXT'](target, GL.queries[id])
    }

    var _emscripten_glBeginQueryEXT = _glBeginQueryEXT

    /** @suppress {duplicate } */ var _glBindAttribLocation = (program, index, name) => {
      GLctx.bindAttribLocation(GL.programs[program], index, UTF8ToString(name))
    }

    var _emscripten_glBindAttribLocation = _glBindAttribLocation

    /** @suppress {duplicate } */ var _glBindBuffer = (target, buffer) => {
      GLctx.bindBuffer(target, GL.buffers[buffer])
    }

    var _emscripten_glBindBuffer = _glBindBuffer

    /** @suppress {duplicate } */ var _glBindFramebuffer = (target, framebuffer) => {
      GLctx.bindFramebuffer(target, GL.framebuffers[framebuffer])
    }

    var _emscripten_glBindFramebuffer = _glBindFramebuffer

    /** @suppress {duplicate } */ var _glBindRenderbuffer = (target, renderbuffer) => {
      GLctx.bindRenderbuffer(target, GL.renderbuffers[renderbuffer])
    }

    var _emscripten_glBindRenderbuffer = _glBindRenderbuffer

    /** @suppress {duplicate } */ var _glBindTexture = (target, texture) => {
      GLctx.bindTexture(target, GL.textures[texture])
    }

    var _emscripten_glBindTexture = _glBindTexture

    /** @suppress {duplicate } */ var _glBindVertexArray = (vao) => {
      GLctx.bindVertexArray(GL.vaos[vao])
    }

    /** @suppress {duplicate } */ var _glBindVertexArrayOES = _glBindVertexArray

    var _emscripten_glBindVertexArrayOES = _glBindVertexArrayOES

    /** @suppress {duplicate } */ var _glBlendColor = (x0, x1, x2, x3) =>
      GLctx.blendColor(x0, x1, x2, x3)

    var _emscripten_glBlendColor = _glBlendColor

    /** @suppress {duplicate } */ var _glBlendEquation = (x0) => GLctx.blendEquation(x0)

    var _emscripten_glBlendEquation = _glBlendEquation

    /** @suppress {duplicate } */ var _glBlendEquationSeparate = (x0, x1) =>
      GLctx.blendEquationSeparate(x0, x1)

    var _emscripten_glBlendEquationSeparate = _glBlendEquationSeparate

    /** @suppress {duplicate } */ var _glBlendFunc = (x0, x1) => GLctx.blendFunc(x0, x1)

    var _emscripten_glBlendFunc = _glBlendFunc

    /** @suppress {duplicate } */ var _glBlendFuncSeparate = (x0, x1, x2, x3) =>
      GLctx.blendFuncSeparate(x0, x1, x2, x3)

    var _emscripten_glBlendFuncSeparate = _glBlendFuncSeparate

    /** @suppress {duplicate } */ var _glBufferData = (target, size, data, usage) => {
      // N.b. here first form specifies a heap subarray, second form an integer
      // size, so the ?: code here is polymorphic. It is advised to avoid
      // randomly mixing both uses in calling code, to avoid any potential JS
      // engine JIT issues.
      GLctx.bufferData(target, data ? GROWABLE_HEAP_U8().subarray(data, data + size) : size, usage)
    }

    var _emscripten_glBufferData = _glBufferData

    /** @suppress {duplicate } */ var _glBufferSubData = (target, offset, size, data) => {
      GLctx.bufferSubData(target, offset, GROWABLE_HEAP_U8().subarray(data, data + size))
    }

    var _emscripten_glBufferSubData = _glBufferSubData

    /** @suppress {duplicate } */ var _glCheckFramebufferStatus = (x0) =>
      GLctx.checkFramebufferStatus(x0)

    var _emscripten_glCheckFramebufferStatus = _glCheckFramebufferStatus

    /** @suppress {duplicate } */ var _glClear = (x0) => GLctx.clear(x0)

    var _emscripten_glClear = _glClear

    /** @suppress {duplicate } */ var _glClearColor = (x0, x1, x2, x3) =>
      GLctx.clearColor(x0, x1, x2, x3)

    var _emscripten_glClearColor = _glClearColor

    /** @suppress {duplicate } */ var _glClearDepthf = (x0) => GLctx.clearDepth(x0)

    var _emscripten_glClearDepthf = _glClearDepthf

    /** @suppress {duplicate } */ var _glClearStencil = (x0) => GLctx.clearStencil(x0)

    var _emscripten_glClearStencil = _glClearStencil

    /** @suppress {duplicate } */ var _glColorMask = (red, green, blue, alpha) => {
      GLctx.colorMask(!!red, !!green, !!blue, !!alpha)
    }

    var _emscripten_glColorMask = _glColorMask

    /** @suppress {duplicate } */ var _glCompileShader = (shader) => {
      GLctx.compileShader(GL.shaders[shader])
    }

    var _emscripten_glCompileShader = _glCompileShader

    /** @suppress {duplicate } */ var _glCompressedTexImage2D = (
      target,
      level,
      internalFormat,
      width,
      height,
      border,
      imageSize,
      data
    ) => {
      GLctx.compressedTexImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        data ? GROWABLE_HEAP_U8().subarray(data, data + imageSize) : null
      )
    }

    var _emscripten_glCompressedTexImage2D = _glCompressedTexImage2D

    /** @suppress {duplicate } */ var _glCompressedTexSubImage2D = (
      target,
      level,
      xoffset,
      yoffset,
      width,
      height,
      format,
      imageSize,
      data
    ) => {
      GLctx.compressedTexSubImage2D(
        target,
        level,
        xoffset,
        yoffset,
        width,
        height,
        format,
        data ? GROWABLE_HEAP_U8().subarray(data, data + imageSize) : null
      )
    }

    var _emscripten_glCompressedTexSubImage2D = _glCompressedTexSubImage2D

    /** @suppress {duplicate } */ var _glCopyTexImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) =>
      GLctx.copyTexImage2D(x0, x1, x2, x3, x4, x5, x6, x7)

    var _emscripten_glCopyTexImage2D = _glCopyTexImage2D

    /** @suppress {duplicate } */ var _glCopyTexSubImage2D = (x0, x1, x2, x3, x4, x5, x6, x7) =>
      GLctx.copyTexSubImage2D(x0, x1, x2, x3, x4, x5, x6, x7)

    var _emscripten_glCopyTexSubImage2D = _glCopyTexSubImage2D

    /** @suppress {duplicate } */ var _glCreateProgram = () => {
      var id = GL.getNewId(GL.programs)
      var program = GLctx.createProgram()
      // Store additional information needed for each shader program:
      program.name = id
      // Lazy cache results of
      // glGetProgramiv(GL_ACTIVE_UNIFORM_MAX_LENGTH/GL_ACTIVE_ATTRIBUTE_MAX_LENGTH/GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH)
      program.maxUniformLength = program.maxAttributeLength = program.maxUniformBlockNameLength = 0
      program.uniformIdCounter = 1
      GL.programs[id] = program
      return id
    }

    var _emscripten_glCreateProgram = _glCreateProgram

    /** @suppress {duplicate } */ var _glCreateShader = (shaderType) => {
      var id = GL.getNewId(GL.shaders)
      GL.shaders[id] = GLctx.createShader(shaderType)
      return id
    }

    var _emscripten_glCreateShader = _glCreateShader

    /** @suppress {duplicate } */ var _glCullFace = (x0) => GLctx.cullFace(x0)

    var _emscripten_glCullFace = _glCullFace

    /** @suppress {duplicate } */ var _glDeleteBuffers = (n, buffers) => {
      for (var i = 0; i < n; i++) {
        var id = GROWABLE_HEAP_I32()[(buffers + i * 4) >> 2]
        var buffer = GL.buffers[id]
        // From spec: "glDeleteBuffers silently ignores 0's and names that do not
        // correspond to existing buffer objects."
        if (!buffer) continue
        GLctx.deleteBuffer(buffer)
        buffer.name = 0
        GL.buffers[id] = null
      }
    }

    var _emscripten_glDeleteBuffers = _glDeleteBuffers

    /** @suppress {duplicate } */ var _glDeleteFramebuffers = (n, framebuffers) => {
      for (var i = 0; i < n; ++i) {
        var id = GROWABLE_HEAP_I32()[(framebuffers + i * 4) >> 2]
        var framebuffer = GL.framebuffers[id]
        if (!framebuffer) continue
        // GL spec: "glDeleteFramebuffers silently ignores 0s and names that do not correspond to existing framebuffer objects".
        GLctx.deleteFramebuffer(framebuffer)
        framebuffer.name = 0
        GL.framebuffers[id] = null
      }
    }

    var _emscripten_glDeleteFramebuffers = _glDeleteFramebuffers

    /** @suppress {duplicate } */ var _glDeleteProgram = (id) => {
      if (!id) return
      var program = GL.programs[id]
      if (!program) {
        // glDeleteProgram actually signals an error when deleting a nonexisting
        // object, unlike some other GL delete functions.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GLctx.deleteProgram(program)
      program.name = 0
      GL.programs[id] = null
    }

    var _emscripten_glDeleteProgram = _glDeleteProgram

    /** @suppress {duplicate } */ var _glDeleteQueriesEXT = (n, ids) => {
      for (var i = 0; i < n; i++) {
        var id = GROWABLE_HEAP_I32()[(ids + i * 4) >> 2]
        var query = GL.queries[id]
        if (!query) continue
        // GL spec: "unused names in ids are ignored, as is the name zero."
        GLctx.disjointTimerQueryExt['deleteQueryEXT'](query)
        GL.queries[id] = null
      }
    }

    var _emscripten_glDeleteQueriesEXT = _glDeleteQueriesEXT

    /** @suppress {duplicate } */ var _glDeleteRenderbuffers = (n, renderbuffers) => {
      for (var i = 0; i < n; i++) {
        var id = GROWABLE_HEAP_I32()[(renderbuffers + i * 4) >> 2]
        var renderbuffer = GL.renderbuffers[id]
        if (!renderbuffer) continue
        // GL spec: "glDeleteRenderbuffers silently ignores 0s and names that do not correspond to existing renderbuffer objects".
        GLctx.deleteRenderbuffer(renderbuffer)
        renderbuffer.name = 0
        GL.renderbuffers[id] = null
      }
    }

    var _emscripten_glDeleteRenderbuffers = _glDeleteRenderbuffers

    /** @suppress {duplicate } */ var _glDeleteShader = (id) => {
      if (!id) return
      var shader = GL.shaders[id]
      if (!shader) {
        // glDeleteShader actually signals an error when deleting a nonexisting
        // object, unlike some other GL delete functions.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GLctx.deleteShader(shader)
      GL.shaders[id] = null
    }

    var _emscripten_glDeleteShader = _glDeleteShader

    /** @suppress {duplicate } */ var _glDeleteTextures = (n, textures) => {
      for (var i = 0; i < n; i++) {
        var id = GROWABLE_HEAP_I32()[(textures + i * 4) >> 2]
        var texture = GL.textures[id]
        // GL spec: "glDeleteTextures silently ignores 0s and names that do not
        // correspond to existing textures".
        if (!texture) continue
        GLctx.deleteTexture(texture)
        texture.name = 0
        GL.textures[id] = null
      }
    }

    var _emscripten_glDeleteTextures = _glDeleteTextures

    /** @suppress {duplicate } */ var _glDeleteVertexArrays = (n, vaos) => {
      for (var i = 0; i < n; i++) {
        var id = GROWABLE_HEAP_I32()[(vaos + i * 4) >> 2]
        GLctx.deleteVertexArray(GL.vaos[id])
        GL.vaos[id] = null
      }
    }

    /** @suppress {duplicate } */ var _glDeleteVertexArraysOES = _glDeleteVertexArrays

    var _emscripten_glDeleteVertexArraysOES = _glDeleteVertexArraysOES

    /** @suppress {duplicate } */ var _glDepthFunc = (x0) => GLctx.depthFunc(x0)

    var _emscripten_glDepthFunc = _glDepthFunc

    /** @suppress {duplicate } */ var _glDepthMask = (flag) => {
      GLctx.depthMask(!!flag)
    }

    var _emscripten_glDepthMask = _glDepthMask

    /** @suppress {duplicate } */ var _glDepthRangef = (x0, x1) => GLctx.depthRange(x0, x1)

    var _emscripten_glDepthRangef = _glDepthRangef

    /** @suppress {duplicate } */ var _glDetachShader = (program, shader) => {
      GLctx.detachShader(GL.programs[program], GL.shaders[shader])
    }

    var _emscripten_glDetachShader = _glDetachShader

    /** @suppress {duplicate } */ var _glDisable = (x0) => GLctx.disable(x0)

    var _emscripten_glDisable = _glDisable

    /** @suppress {duplicate } */ var _glDisableVertexAttribArray = (index) => {
      GLctx.disableVertexAttribArray(index)
    }

    var _emscripten_glDisableVertexAttribArray = _glDisableVertexAttribArray

    /** @suppress {duplicate } */ var _glDrawArrays = (mode, first, count) => {
      GLctx.drawArrays(mode, first, count)
    }

    var _emscripten_glDrawArrays = _glDrawArrays

    /** @suppress {duplicate } */ var _glDrawArraysInstanced = (mode, first, count, primcount) => {
      GLctx.drawArraysInstanced(mode, first, count, primcount)
    }

    /** @suppress {duplicate } */ var _glDrawArraysInstancedANGLE = _glDrawArraysInstanced

    var _emscripten_glDrawArraysInstancedANGLE = _glDrawArraysInstancedANGLE

    var tempFixedLengthArray = []

    /** @suppress {duplicate } */ var _glDrawBuffers = (n, bufs) => {
      var bufArray = tempFixedLengthArray[n]
      for (var i = 0; i < n; i++) {
        bufArray[i] = GROWABLE_HEAP_I32()[(bufs + i * 4) >> 2]
      }
      GLctx.drawBuffers(bufArray)
    }

    /** @suppress {duplicate } */ var _glDrawBuffersWEBGL = _glDrawBuffers

    var _emscripten_glDrawBuffersWEBGL = _glDrawBuffersWEBGL

    /** @suppress {duplicate } */ var _glDrawElements = (mode, count, type, indices) => {
      GLctx.drawElements(mode, count, type, indices)
    }

    var _emscripten_glDrawElements = _glDrawElements

    /** @suppress {duplicate } */ var _glDrawElementsInstanced = (
      mode,
      count,
      type,
      indices,
      primcount
    ) => {
      GLctx.drawElementsInstanced(mode, count, type, indices, primcount)
    }

    /** @suppress {duplicate } */ var _glDrawElementsInstancedANGLE = _glDrawElementsInstanced

    var _emscripten_glDrawElementsInstancedANGLE = _glDrawElementsInstancedANGLE

    /** @suppress {duplicate } */ var _glEnable = (x0) => GLctx.enable(x0)

    var _emscripten_glEnable = _glEnable

    /** @suppress {duplicate } */ var _glEnableVertexAttribArray = (index) => {
      GLctx.enableVertexAttribArray(index)
    }

    var _emscripten_glEnableVertexAttribArray = _glEnableVertexAttribArray

    /** @suppress {duplicate } */ var _glEndQueryEXT = (target) => {
      GLctx.disjointTimerQueryExt['endQueryEXT'](target)
    }

    var _emscripten_glEndQueryEXT = _glEndQueryEXT

    /** @suppress {duplicate } */ var _glFinish = () => GLctx.finish()

    var _emscripten_glFinish = _glFinish

    /** @suppress {duplicate } */ var _glFlush = () => GLctx.flush()

    var _emscripten_glFlush = _glFlush

    /** @suppress {duplicate } */ var _glFramebufferRenderbuffer = (
      target,
      attachment,
      renderbuffertarget,
      renderbuffer
    ) => {
      GLctx.framebufferRenderbuffer(
        target,
        attachment,
        renderbuffertarget,
        GL.renderbuffers[renderbuffer]
      )
    }

    var _emscripten_glFramebufferRenderbuffer = _glFramebufferRenderbuffer

    /** @suppress {duplicate } */ var _glFramebufferTexture2D = (
      target,
      attachment,
      textarget,
      texture,
      level
    ) => {
      GLctx.framebufferTexture2D(target, attachment, textarget, GL.textures[texture], level)
    }

    var _emscripten_glFramebufferTexture2D = _glFramebufferTexture2D

    /** @suppress {duplicate } */ var _glFrontFace = (x0) => GLctx.frontFace(x0)

    var _emscripten_glFrontFace = _glFrontFace

    /** @suppress {duplicate } */ var _glGenBuffers = (n, buffers) => {
      GL.genObject(n, buffers, 'createBuffer', GL.buffers)
    }

    var _emscripten_glGenBuffers = _glGenBuffers

    /** @suppress {duplicate } */ var _glGenFramebuffers = (n, ids) => {
      GL.genObject(n, ids, 'createFramebuffer', GL.framebuffers)
    }

    var _emscripten_glGenFramebuffers = _glGenFramebuffers

    /** @suppress {duplicate } */ var _glGenQueriesEXT = (n, ids) => {
      for (var i = 0; i < n; i++) {
        var query = GLctx.disjointTimerQueryExt['createQueryEXT']()
        if (!query) {
          GL.recordError(1282)
          /* GL_INVALID_OPERATION */ while (i < n) GROWABLE_HEAP_I32()[(ids + i++ * 4) >> 2] = 0
          return
        }
        var id = GL.getNewId(GL.queries)
        query.name = id
        GL.queries[id] = query
        GROWABLE_HEAP_I32()[(ids + i * 4) >> 2] = id
      }
    }

    var _emscripten_glGenQueriesEXT = _glGenQueriesEXT

    /** @suppress {duplicate } */ var _glGenRenderbuffers = (n, renderbuffers) => {
      GL.genObject(n, renderbuffers, 'createRenderbuffer', GL.renderbuffers)
    }

    var _emscripten_glGenRenderbuffers = _glGenRenderbuffers

    /** @suppress {duplicate } */ var _glGenTextures = (n, textures) => {
      GL.genObject(n, textures, 'createTexture', GL.textures)
    }

    var _emscripten_glGenTextures = _glGenTextures

    /** @suppress {duplicate } */ var _glGenVertexArrays = (n, arrays) => {
      GL.genObject(n, arrays, 'createVertexArray', GL.vaos)
    }

    /** @suppress {duplicate } */ var _glGenVertexArraysOES = _glGenVertexArrays

    var _emscripten_glGenVertexArraysOES = _glGenVertexArraysOES

    /** @suppress {duplicate } */ var _glGenerateMipmap = (x0) => GLctx.generateMipmap(x0)

    var _emscripten_glGenerateMipmap = _glGenerateMipmap

    var __glGetActiveAttribOrUniform = (
      funcName,
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) => {
      program = GL.programs[program]
      var info = GLctx[funcName](program, index)
      if (info) {
        // If an error occurs, nothing will be written to length, size and type and name.
        var numBytesWrittenExclNull = name && stringToUTF8(info.name, name, bufSize)
        if (length) GROWABLE_HEAP_I32()[length >> 2] = numBytesWrittenExclNull
        if (size) GROWABLE_HEAP_I32()[size >> 2] = info.size
        if (type) GROWABLE_HEAP_I32()[type >> 2] = info.type
      }
    }

    /** @suppress {duplicate } */ var _glGetActiveAttrib = (
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) => {
      __glGetActiveAttribOrUniform(
        'getActiveAttrib',
        program,
        index,
        bufSize,
        length,
        size,
        type,
        name
      )
    }

    var _emscripten_glGetActiveAttrib = _glGetActiveAttrib

    /** @suppress {duplicate } */ var _glGetActiveUniform = (
      program,
      index,
      bufSize,
      length,
      size,
      type,
      name
    ) => {
      __glGetActiveAttribOrUniform(
        'getActiveUniform',
        program,
        index,
        bufSize,
        length,
        size,
        type,
        name
      )
    }

    var _emscripten_glGetActiveUniform = _glGetActiveUniform

    /** @suppress {duplicate } */ var _glGetAttachedShaders = (
      program,
      maxCount,
      count,
      shaders
    ) => {
      var result = GLctx.getAttachedShaders(GL.programs[program])
      var len = result.length
      if (len > maxCount) {
        len = maxCount
      }
      GROWABLE_HEAP_I32()[count >> 2] = len
      for (var i = 0; i < len; ++i) {
        var id = GL.shaders.indexOf(result[i])
        GROWABLE_HEAP_I32()[(shaders + i * 4) >> 2] = id
      }
    }

    var _emscripten_glGetAttachedShaders = _glGetAttachedShaders

    /** @suppress {duplicate } */ var _glGetAttribLocation = (program, name) =>
      GLctx.getAttribLocation(GL.programs[program], UTF8ToString(name))

    var _emscripten_glGetAttribLocation = _glGetAttribLocation

    var writeI53ToI64 = (ptr, num) => {
      GROWABLE_HEAP_U32()[ptr >> 2] = num
      var lower = GROWABLE_HEAP_U32()[ptr >> 2]
      GROWABLE_HEAP_U32()[(ptr + 4) >> 2] = (num - lower) / 4294967296
    }

    var emscriptenWebGLGet = (name_, p, type) => {
      // Guard against user passing a null pointer.
      // Note that GLES2 spec does not say anything about how passing a null
      // pointer should be treated.  Testing on desktop core GL 3, the application
      // crashes on glGetIntegerv to a null pointer, but better to report an error
      // instead of doing anything random.
      if (!p) {
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      var ret = undefined
      switch (name_) {
        // Handle a few trivial GLES values
        case 36346:
          // GL_SHADER_COMPILER
          ret = 1
          break

        case 36344:
          // GL_SHADER_BINARY_FORMATS
          if (type != 0 && type != 1) {
            GL.recordError(1280)
          }
          // Do not write anything to the out pointer, since no binary formats are
          // supported.
          return

        case 36345:
          // GL_NUM_SHADER_BINARY_FORMATS
          ret = 0
          break

        case 34466:
          // GL_NUM_COMPRESSED_TEXTURE_FORMATS
          // WebGL doesn't have GL_NUM_COMPRESSED_TEXTURE_FORMATS (it's obsolete
          // since GL_COMPRESSED_TEXTURE_FORMATS returns a JS array that can be
          // queried for length), so implement it ourselves to allow C++ GLES2
          // code get the length.
          var formats = GLctx.getParameter(34467)
          /*GL_COMPRESSED_TEXTURE_FORMATS*/ ret = formats ? formats.length : 0
          break
      }
      if (ret === undefined) {
        var result = GLctx.getParameter(name_)
        switch (typeof result) {
          case 'number':
            ret = result
            break

          case 'boolean':
            ret = result ? 1 : 0
            break

          case 'string':
            GL.recordError(1280)
            // GL_INVALID_ENUM
            return

          case 'object':
            if (result === null) {
              // null is a valid result for some (e.g., which buffer is bound -
              // perhaps nothing is bound), but otherwise can mean an invalid
              // name_, which we need to report as an error
              switch (name_) {
                case 34964:
                // ARRAY_BUFFER_BINDING
                case 35725:
                // CURRENT_PROGRAM
                case 34965:
                // ELEMENT_ARRAY_BUFFER_BINDING
                case 36006:
                // FRAMEBUFFER_BINDING or DRAW_FRAMEBUFFER_BINDING
                case 36007:
                // RENDERBUFFER_BINDING
                case 32873:
                // TEXTURE_BINDING_2D
                case 34229:
                // WebGL 2 GL_VERTEX_ARRAY_BINDING, or WebGL 1 extension OES_vertex_array_object GL_VERTEX_ARRAY_BINDING_OES
                case 34068: {
                  // TEXTURE_BINDING_CUBE_MAP
                  ret = 0
                  break
                }

                default: {
                  GL.recordError(1280)
                  // GL_INVALID_ENUM
                  return
                }
              }
            } else if (
              result instanceof Float32Array ||
              result instanceof Uint32Array ||
              result instanceof Int32Array ||
              result instanceof Array
            ) {
              for (var i = 0; i < result.length; ++i) {
                switch (type) {
                  case 0:
                    GROWABLE_HEAP_I32()[(p + i * 4) >> 2] = result[i]
                    break

                  case 2:
                    GROWABLE_HEAP_F32()[(p + i * 4) >> 2] = result[i]
                    break

                  case 4:
                    GROWABLE_HEAP_I8()[p + i] = result[i] ? 1 : 0
                    break
                }
              }
              return
            } else {
              try {
                ret = result.name | 0
              } catch (e) {
                GL.recordError(1280)
                // GL_INVALID_ENUM
                err(
                  `GL_INVALID_ENUM in glGet${type}v: Unknown object returned from WebGL getParameter(${name_})! (error: ${e})`
                )
                return
              }
            }
            break

          default:
            GL.recordError(1280)
            // GL_INVALID_ENUM
            err(
              `GL_INVALID_ENUM in glGet${type}v: Native code calling glGet${type}v(${name_}) and it returns ${result} of type ${typeof result}!`
            )
            return
        }
      }
      switch (type) {
        case 1:
          writeI53ToI64(p, ret)
          break

        case 0:
          GROWABLE_HEAP_I32()[p >> 2] = ret
          break

        case 2:
          GROWABLE_HEAP_F32()[p >> 2] = ret
          break

        case 4:
          GROWABLE_HEAP_I8()[p] = ret ? 1 : 0
          break
      }
    }

    /** @suppress {duplicate } */ var _glGetBooleanv = (name_, p) => emscriptenWebGLGet(name_, p, 4)

    var _emscripten_glGetBooleanv = _glGetBooleanv

    /** @suppress {duplicate } */ var _glGetBufferParameteriv = (target, value, data) => {
      if (!data) {
        // GLES2 specification does not specify how to behave if data is a null
        // pointer. Since calling this function does not make sense if data ==
        // null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GROWABLE_HEAP_I32()[data >> 2] = GLctx.getBufferParameter(target, value)
    }

    var _emscripten_glGetBufferParameteriv = _glGetBufferParameteriv

    /** @suppress {duplicate } */ var _glGetError = () => {
      var error = GLctx.getError() || GL.lastError
      GL.lastError = 0
      /*GL_NO_ERROR*/ return error
    }

    var _emscripten_glGetError = _glGetError

    /** @suppress {duplicate } */ var _glGetFloatv = (name_, p) => emscriptenWebGLGet(name_, p, 2)

    var _emscripten_glGetFloatv = _glGetFloatv

    /** @suppress {duplicate } */ var _glGetFramebufferAttachmentParameteriv = (
      target,
      attachment,
      pname,
      params
    ) => {
      var result = GLctx.getFramebufferAttachmentParameter(target, attachment, pname)
      if (result instanceof WebGLRenderbuffer || result instanceof WebGLTexture) {
        result = result.name | 0
      }
      GROWABLE_HEAP_I32()[params >> 2] = result
    }

    var _emscripten_glGetFramebufferAttachmentParameteriv = _glGetFramebufferAttachmentParameteriv

    /** @suppress {duplicate } */ var _glGetIntegerv = (name_, p) => emscriptenWebGLGet(name_, p, 0)

    var _emscripten_glGetIntegerv = _glGetIntegerv

    /** @suppress {duplicate } */ var _glGetProgramInfoLog = (
      program,
      maxLength,
      length,
      infoLog
    ) => {
      var log = GLctx.getProgramInfoLog(GL.programs[program])
      if (log === null) log = '(unknown error)'
      var numBytesWrittenExclNull =
        maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0
      if (length) GROWABLE_HEAP_I32()[length >> 2] = numBytesWrittenExclNull
    }

    var _emscripten_glGetProgramInfoLog = _glGetProgramInfoLog

    /** @suppress {duplicate } */ var _glGetProgramiv = (program, pname, p) => {
      if (!p) {
        // GLES2 specification does not specify how to behave if p is a null
        // pointer. Since calling this function does not make sense if p == null,
        // issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      if (program >= GL.counter) {
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      program = GL.programs[program]
      if (pname == 35716) {
        // GL_INFO_LOG_LENGTH
        var log = GLctx.getProgramInfoLog(program)
        if (log === null) log = '(unknown error)'
        GROWABLE_HEAP_I32()[p >> 2] = log.length + 1
      } else if (pname == 35719) {
        /* GL_ACTIVE_UNIFORM_MAX_LENGTH */ if (!program.maxUniformLength) {
          for (
            var i = 0;
            i < GLctx.getProgramParameter(program, 35718);
            /*GL_ACTIVE_UNIFORMS*/ ++i
          ) {
            program.maxUniformLength = Math.max(
              program.maxUniformLength,
              GLctx.getActiveUniform(program, i).name.length + 1
            )
          }
        }
        GROWABLE_HEAP_I32()[p >> 2] = program.maxUniformLength
      } else if (pname == 35722) {
        /* GL_ACTIVE_ATTRIBUTE_MAX_LENGTH */ if (!program.maxAttributeLength) {
          for (
            var i = 0;
            i < GLctx.getProgramParameter(program, 35721);
            /*GL_ACTIVE_ATTRIBUTES*/ ++i
          ) {
            program.maxAttributeLength = Math.max(
              program.maxAttributeLength,
              GLctx.getActiveAttrib(program, i).name.length + 1
            )
          }
        }
        GROWABLE_HEAP_I32()[p >> 2] = program.maxAttributeLength
      } else if (pname == 35381) {
        /* GL_ACTIVE_UNIFORM_BLOCK_MAX_NAME_LENGTH */ if (!program.maxUniformBlockNameLength) {
          for (
            var i = 0;
            i < GLctx.getProgramParameter(program, 35382);
            /*GL_ACTIVE_UNIFORM_BLOCKS*/ ++i
          ) {
            program.maxUniformBlockNameLength = Math.max(
              program.maxUniformBlockNameLength,
              GLctx.getActiveUniformBlockName(program, i).length + 1
            )
          }
        }
        GROWABLE_HEAP_I32()[p >> 2] = program.maxUniformBlockNameLength
      } else {
        GROWABLE_HEAP_I32()[p >> 2] = GLctx.getProgramParameter(program, pname)
      }
    }

    var _emscripten_glGetProgramiv = _glGetProgramiv

    /** @suppress {duplicate } */ var _glGetQueryObjecti64vEXT = (id, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
        // if p == null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      var query = GL.queries[id]
      var param
      {
        param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](query, pname)
      }
      var ret
      if (typeof param == 'boolean') {
        ret = param ? 1 : 0
      } else {
        ret = param
      }
      writeI53ToI64(params, ret)
    }

    var _emscripten_glGetQueryObjecti64vEXT = _glGetQueryObjecti64vEXT

    /** @suppress {duplicate } */ var _glGetQueryObjectivEXT = (id, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
        // if p == null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      var query = GL.queries[id]
      var param = GLctx.disjointTimerQueryExt['getQueryObjectEXT'](query, pname)
      var ret
      if (typeof param == 'boolean') {
        ret = param ? 1 : 0
      } else {
        ret = param
      }
      GROWABLE_HEAP_I32()[params >> 2] = ret
    }

    var _emscripten_glGetQueryObjectivEXT = _glGetQueryObjectivEXT

    /** @suppress {duplicate } */ var _glGetQueryObjectui64vEXT = _glGetQueryObjecti64vEXT

    var _emscripten_glGetQueryObjectui64vEXT = _glGetQueryObjectui64vEXT

    /** @suppress {duplicate } */ var _glGetQueryObjectuivEXT = _glGetQueryObjectivEXT

    var _emscripten_glGetQueryObjectuivEXT = _glGetQueryObjectuivEXT

    /** @suppress {duplicate } */ var _glGetQueryivEXT = (target, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
        // if p == null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GROWABLE_HEAP_I32()[params >> 2] = GLctx.disjointTimerQueryExt['getQueryEXT'](target, pname)
    }

    var _emscripten_glGetQueryivEXT = _glGetQueryivEXT

    /** @suppress {duplicate } */ var _glGetRenderbufferParameteriv = (target, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null pointer. Since calling this function does not make sense
        // if params == null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GROWABLE_HEAP_I32()[params >> 2] = GLctx.getRenderbufferParameter(target, pname)
    }

    var _emscripten_glGetRenderbufferParameteriv = _glGetRenderbufferParameteriv

    /** @suppress {duplicate } */ var _glGetShaderInfoLog = (
      shader,
      maxLength,
      length,
      infoLog
    ) => {
      var log = GLctx.getShaderInfoLog(GL.shaders[shader])
      if (log === null) log = '(unknown error)'
      var numBytesWrittenExclNull =
        maxLength > 0 && infoLog ? stringToUTF8(log, infoLog, maxLength) : 0
      if (length) GROWABLE_HEAP_I32()[length >> 2] = numBytesWrittenExclNull
    }

    var _emscripten_glGetShaderInfoLog = _glGetShaderInfoLog

    /** @suppress {duplicate } */ var _glGetShaderPrecisionFormat = (
      shaderType,
      precisionType,
      range,
      precision
    ) => {
      var result = GLctx.getShaderPrecisionFormat(shaderType, precisionType)
      GROWABLE_HEAP_I32()[range >> 2] = result.rangeMin
      GROWABLE_HEAP_I32()[(range + 4) >> 2] = result.rangeMax
      GROWABLE_HEAP_I32()[precision >> 2] = result.precision
    }

    var _emscripten_glGetShaderPrecisionFormat = _glGetShaderPrecisionFormat

    /** @suppress {duplicate } */ var _glGetShaderSource = (shader, bufSize, length, source) => {
      var result = GLctx.getShaderSource(GL.shaders[shader])
      if (!result) return
      // If an error occurs, nothing will be written to length or source.
      var numBytesWrittenExclNull =
        bufSize > 0 && source ? stringToUTF8(result, source, bufSize) : 0
      if (length) GROWABLE_HEAP_I32()[length >> 2] = numBytesWrittenExclNull
    }

    var _emscripten_glGetShaderSource = _glGetShaderSource

    /** @suppress {duplicate } */ var _glGetShaderiv = (shader, pname, p) => {
      if (!p) {
        // GLES2 specification does not specify how to behave if p is a null
        // pointer. Since calling this function does not make sense if p == null,
        // issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      if (pname == 35716) {
        // GL_INFO_LOG_LENGTH
        var log = GLctx.getShaderInfoLog(GL.shaders[shader])
        if (log === null) log = '(unknown error)'
        // The GLES2 specification says that if the shader has an empty info log,
        // a value of 0 is returned. Otherwise the log has a null char appended.
        // (An empty string is falsey, so we can just check that instead of
        // looking at log.length.)
        var logLength = log ? log.length + 1 : 0
        GROWABLE_HEAP_I32()[p >> 2] = logLength
      } else if (pname == 35720) {
        // GL_SHADER_SOURCE_LENGTH
        var source = GLctx.getShaderSource(GL.shaders[shader])
        // source may be a null, or the empty string, both of which are falsey
        // values that we report a 0 length for.
        var sourceLength = source ? source.length + 1 : 0
        GROWABLE_HEAP_I32()[p >> 2] = sourceLength
      } else {
        GROWABLE_HEAP_I32()[p >> 2] = GLctx.getShaderParameter(GL.shaders[shader], pname)
      }
    }

    var _emscripten_glGetShaderiv = _glGetShaderiv

    var stringToNewUTF8 = (str) => {
      var size = lengthBytesUTF8(str) + 1
      var ret = _malloc(size)
      if (ret) stringToUTF8(str, ret, size)
      return ret
    }

    var webglGetExtensions = function $webglGetExtensions() {
      var exts = getEmscriptenSupportedExtensions(GLctx)
      exts = exts.concat(exts.map((e) => 'GL_' + e))
      return exts
    }

    /** @suppress {duplicate } */ var _glGetString = (name_) => {
      var ret = GL.stringCache[name_]
      if (!ret) {
        switch (name_) {
          case 7939:
            /* GL_EXTENSIONS */ ret = stringToNewUTF8(webglGetExtensions().join(' '))
            break

          case 7936:
          /* GL_VENDOR */ case 7937:
          /* GL_RENDERER */ case 37445:
          /* UNMASKED_VENDOR_WEBGL */ case 37446:
            /* UNMASKED_RENDERER_WEBGL */ var s = GLctx.getParameter(name_)
            if (!s) {
              GL.recordError(1280)
            }
            ret = s ? stringToNewUTF8(s) : 0
            break

          case 7938:
            /* GL_VERSION */ var glVersion = GLctx.getParameter(7938)
            // return GLES version string corresponding to the version of the WebGL context
            {
              glVersion = `OpenGL ES 2.0 (${glVersion})`
            }
            ret = stringToNewUTF8(glVersion)
            break

          case 35724:
            /* GL_SHADING_LANGUAGE_VERSION */ var glslVersion = GLctx.getParameter(35724)
            // extract the version number 'N.M' from the string 'WebGL GLSL ES N.M ...'
            var ver_re = /^WebGL GLSL ES ([0-9]\.[0-9][0-9]?)(?:$| .*)/
            var ver_num = glslVersion.match(ver_re)
            if (ver_num !== null) {
              if (ver_num[1].length == 3) ver_num[1] = ver_num[1] + '0'
              // ensure minor version has 2 digits
              glslVersion = `OpenGL ES GLSL ES ${ver_num[1]} (${glslVersion})`
            }
            ret = stringToNewUTF8(glslVersion)
            break

          default:
            GL.recordError(1280)
        }
        // fall through
        GL.stringCache[name_] = ret
      }
      return ret
    }

    var _emscripten_glGetString = _glGetString

    /** @suppress {duplicate } */ var _glGetTexParameterfv = (target, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null
        // pointer. Since calling this function does not make sense if p == null,
        // issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GROWABLE_HEAP_F32()[params >> 2] = GLctx.getTexParameter(target, pname)
    }

    var _emscripten_glGetTexParameterfv = _glGetTexParameterfv

    /** @suppress {duplicate } */ var _glGetTexParameteriv = (target, pname, params) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null
        // pointer. Since calling this function does not make sense if p == null,
        // issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GROWABLE_HEAP_I32()[params >> 2] = GLctx.getTexParameter(target, pname)
    }

    var _emscripten_glGetTexParameteriv = _glGetTexParameteriv

    /** @suppress {checkTypes} */ var jstoi_q = (str) => parseInt(str)

    /** @noinline */ var webglGetLeftBracePos = (name) =>
      name.slice(-1) == ']' && name.lastIndexOf('[')

    var webglPrepareUniformLocationsBeforeFirstUse = (program) => {
      var uniformLocsById = program.uniformLocsById, // Maps GLuint -> WebGLUniformLocation
        uniformSizeAndIdsByName = program.uniformSizeAndIdsByName, // Maps name -> [uniform array length, GLuint]
        i,
        j
      // On the first time invocation of glGetUniformLocation on this shader program:
      // initialize cache data structures and discover which uniforms are arrays.
      if (!uniformLocsById) {
        // maps GLint integer locations to WebGLUniformLocations
        program.uniformLocsById = uniformLocsById = {}
        // maps integer locations back to uniform name strings, so that we can lazily fetch uniform array locations
        program.uniformArrayNamesById = {}
        for (i = 0; i < GLctx.getProgramParameter(program, 35718); /*GL_ACTIVE_UNIFORMS*/ ++i) {
          var u = GLctx.getActiveUniform(program, i)
          var nm = u.name
          var sz = u.size
          var lb = webglGetLeftBracePos(nm)
          var arrayName = lb > 0 ? nm.slice(0, lb) : nm
          // Assign a new location.
          var id = program.uniformIdCounter
          program.uniformIdCounter += sz
          // Eagerly get the location of the uniformArray[0] base element.
          // The remaining indices >0 will be left for lazy evaluation to
          // improve performance. Those may never be needed to fetch, if the
          // application fills arrays always in full starting from the first
          // element of the array.
          uniformSizeAndIdsByName[arrayName] = [sz, id]
          // Store placeholder integers in place that highlight that these
          // >0 index locations are array indices pending population.
          for (j = 0; j < sz; ++j) {
            uniformLocsById[id] = j
            program.uniformArrayNamesById[id++] = arrayName
          }
        }
      }
    }

    /** @suppress {duplicate } */ var _glGetUniformLocation = (program, name) => {
      name = UTF8ToString(name)
      if ((program = GL.programs[program])) {
        webglPrepareUniformLocationsBeforeFirstUse(program)
        var uniformLocsById = program.uniformLocsById
        // Maps GLuint -> WebGLUniformLocation
        var arrayIndex = 0
        var uniformBaseName = name
        // Invariant: when populating integer IDs for uniform locations, we must
        // maintain the precondition that arrays reside in contiguous addresses,
        // i.e. for a 'vec4 colors[10];', colors[4] must be at location
        // colors[0]+4.  However, user might call glGetUniformLocation(program,
        // "colors") for an array, so we cannot discover based on the user input
        // arguments whether the uniform we are dealing with is an array. The only
        // way to discover which uniforms are arrays is to enumerate over all the
        // active uniforms in the program.
        var leftBrace = webglGetLeftBracePos(name)
        // If user passed an array accessor "[index]", parse the array index off the accessor.
        if (leftBrace > 0) {
          arrayIndex = jstoi_q(name.slice(leftBrace + 1)) >>> 0
          // "index]", coerce parseInt(']') with >>>0 to treat "foo[]" as "foo[0]" and foo[-1] as unsigned out-of-bounds.
          uniformBaseName = name.slice(0, leftBrace)
        }
        // Have we cached the location of this uniform before?
        // A pair [array length, GLint of the uniform location]
        var sizeAndId = program.uniformSizeAndIdsByName[uniformBaseName]
        // If an uniform with this name exists, and if its index is within the
        // array limits (if it's even an array), query the WebGLlocation, or
        // return an existing cached location.
        if (sizeAndId && arrayIndex < sizeAndId[0]) {
          arrayIndex += sizeAndId[1]
          // Add the base location of the uniform to the array index offset.
          if (
            (uniformLocsById[arrayIndex] =
              uniformLocsById[arrayIndex] || GLctx.getUniformLocation(program, name))
          ) {
            return arrayIndex
          }
        }
      } else {
        // N.b. we are currently unable to distinguish between GL program IDs that
        // never existed vs GL program IDs that have been deleted, so report
        // GL_INVALID_VALUE in both cases.
        GL.recordError(1281)
      }
      /* GL_INVALID_VALUE */ return -1
    }

    var _emscripten_glGetUniformLocation = _glGetUniformLocation

    var webglGetUniformLocation = (location) => {
      var p = GLctx.currentProgram
      if (p) {
        var webglLoc = p.uniformLocsById[location]
        // p.uniformLocsById[location] stores either an integer, or a
        // WebGLUniformLocation.
        // If an integer, we have not yet bound the location, so do it now. The
        // integer value specifies the array index we should bind to.
        if (typeof webglLoc == 'number') {
          p.uniformLocsById[location] = webglLoc = GLctx.getUniformLocation(
            p,
            p.uniformArrayNamesById[location] + (webglLoc > 0 ? `[${webglLoc}]` : '')
          )
        }
        // Else an already cached WebGLUniformLocation, return it.
        return webglLoc
      } else {
        GL.recordError(1282)
      }
    }

    /** @suppress{checkTypes} */ var emscriptenWebGLGetUniform = (
      program,
      location,
      params,
      type
    ) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null
        // pointer. Since calling this function does not make sense if params ==
        // null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      program = GL.programs[program]
      webglPrepareUniformLocationsBeforeFirstUse(program)
      var data = GLctx.getUniform(program, webglGetUniformLocation(location))
      if (typeof data == 'number' || typeof data == 'boolean') {
        switch (type) {
          case 0:
            GROWABLE_HEAP_I32()[params >> 2] = data
            break

          case 2:
            GROWABLE_HEAP_F32()[params >> 2] = data
            break
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          switch (type) {
            case 0:
              GROWABLE_HEAP_I32()[(params + i * 4) >> 2] = data[i]
              break

            case 2:
              GROWABLE_HEAP_F32()[(params + i * 4) >> 2] = data[i]
              break
          }
        }
      }
    }

    /** @suppress {duplicate } */ var _glGetUniformfv = (program, location, params) => {
      emscriptenWebGLGetUniform(program, location, params, 2)
    }

    var _emscripten_glGetUniformfv = _glGetUniformfv

    /** @suppress {duplicate } */ var _glGetUniformiv = (program, location, params) => {
      emscriptenWebGLGetUniform(program, location, params, 0)
    }

    var _emscripten_glGetUniformiv = _glGetUniformiv

    /** @suppress {duplicate } */ var _glGetVertexAttribPointerv = (index, pname, pointer) => {
      if (!pointer) {
        // GLES2 specification does not specify how to behave if pointer is a null
        // pointer. Since calling this function does not make sense if pointer ==
        // null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      GROWABLE_HEAP_I32()[pointer >> 2] = GLctx.getVertexAttribOffset(index, pname)
    }

    var _emscripten_glGetVertexAttribPointerv = _glGetVertexAttribPointerv

    /** @suppress{checkTypes} */ var emscriptenWebGLGetVertexAttrib = (
      index,
      pname,
      params,
      type
    ) => {
      if (!params) {
        // GLES2 specification does not specify how to behave if params is a null
        // pointer. Since calling this function does not make sense if params ==
        // null, issue a GL error to notify user about it.
        GL.recordError(1281)
        /* GL_INVALID_VALUE */ return
      }
      var data = GLctx.getVertexAttrib(index, pname)
      if (pname == 34975) {
        /*VERTEX_ATTRIB_ARRAY_BUFFER_BINDING*/ GROWABLE_HEAP_I32()[params >> 2] =
          data && data['name']
      } else if (typeof data == 'number' || typeof data == 'boolean') {
        switch (type) {
          case 0:
            GROWABLE_HEAP_I32()[params >> 2] = data
            break

          case 2:
            GROWABLE_HEAP_F32()[params >> 2] = data
            break

          case 5:
            GROWABLE_HEAP_I32()[params >> 2] = Math.fround(data)
            break
        }
      } else {
        for (var i = 0; i < data.length; i++) {
          switch (type) {
            case 0:
              GROWABLE_HEAP_I32()[(params + i * 4) >> 2] = data[i]
              break

            case 2:
              GROWABLE_HEAP_F32()[(params + i * 4) >> 2] = data[i]
              break

            case 5:
              GROWABLE_HEAP_I32()[(params + i * 4) >> 2] = Math.fround(data[i])
              break
          }
        }
      }
    }

    /** @suppress {duplicate } */ var _glGetVertexAttribfv = (index, pname, params) => {
      // N.B. This function may only be called if the vertex attribute was
      // specified using the function glVertexAttrib*f(), otherwise the results
      // are undefined. (GLES3 spec 6.1.12)
      emscriptenWebGLGetVertexAttrib(index, pname, params, 2)
    }

    var _emscripten_glGetVertexAttribfv = _glGetVertexAttribfv

    /** @suppress {duplicate } */ var _glGetVertexAttribiv = (index, pname, params) => {
      // N.B. This function may only be called if the vertex attribute was
      // specified using the function glVertexAttrib*f(), otherwise the results
      // are undefined. (GLES3 spec 6.1.12)
      emscriptenWebGLGetVertexAttrib(index, pname, params, 5)
    }

    var _emscripten_glGetVertexAttribiv = _glGetVertexAttribiv

    /** @suppress {duplicate } */ var _glHint = (x0, x1) => GLctx.hint(x0, x1)

    var _emscripten_glHint = _glHint

    /** @suppress {duplicate } */ var _glIsBuffer = (buffer) => {
      var b = GL.buffers[buffer]
      if (!b) return 0
      return GLctx.isBuffer(b)
    }

    var _emscripten_glIsBuffer = _glIsBuffer

    /** @suppress {duplicate } */ var _glIsEnabled = (x0) => GLctx.isEnabled(x0)

    var _emscripten_glIsEnabled = _glIsEnabled

    /** @suppress {duplicate } */ var _glIsFramebuffer = (framebuffer) => {
      var fb = GL.framebuffers[framebuffer]
      if (!fb) return 0
      return GLctx.isFramebuffer(fb)
    }

    var _emscripten_glIsFramebuffer = _glIsFramebuffer

    /** @suppress {duplicate } */ var _glIsProgram = (program) => {
      program = GL.programs[program]
      if (!program) return 0
      return GLctx.isProgram(program)
    }

    var _emscripten_glIsProgram = _glIsProgram

    /** @suppress {duplicate } */ var _glIsQueryEXT = (id) => {
      var query = GL.queries[id]
      if (!query) return 0
      return GLctx.disjointTimerQueryExt['isQueryEXT'](query)
    }

    var _emscripten_glIsQueryEXT = _glIsQueryEXT

    /** @suppress {duplicate } */ var _glIsRenderbuffer = (renderbuffer) => {
      var rb = GL.renderbuffers[renderbuffer]
      if (!rb) return 0
      return GLctx.isRenderbuffer(rb)
    }

    var _emscripten_glIsRenderbuffer = _glIsRenderbuffer

    /** @suppress {duplicate } */ var _glIsShader = (shader) => {
      var s = GL.shaders[shader]
      if (!s) return 0
      return GLctx.isShader(s)
    }

    var _emscripten_glIsShader = _glIsShader

    /** @suppress {duplicate } */ var _glIsTexture = (id) => {
      var texture = GL.textures[id]
      if (!texture) return 0
      return GLctx.isTexture(texture)
    }

    var _emscripten_glIsTexture = _glIsTexture

    /** @suppress {duplicate } */ var _glIsVertexArray = (array) => {
      var vao = GL.vaos[array]
      if (!vao) return 0
      return GLctx.isVertexArray(vao)
    }

    /** @suppress {duplicate } */ var _glIsVertexArrayOES = _glIsVertexArray

    var _emscripten_glIsVertexArrayOES = _glIsVertexArrayOES

    /** @suppress {duplicate } */ var _glLineWidth = (x0) => GLctx.lineWidth(x0)

    var _emscripten_glLineWidth = _glLineWidth

    /** @suppress {duplicate } */ var _glLinkProgram = (program) => {
      program = GL.programs[program]
      GLctx.linkProgram(program)
      // Invalidate earlier computed uniform->ID mappings, those have now become stale
      program.uniformLocsById = 0
      // Mark as null-like so that glGetUniformLocation() knows to populate this again.
      program.uniformSizeAndIdsByName = {}
    }

    var _emscripten_glLinkProgram = _glLinkProgram

    /** @suppress {duplicate } */ var _glPixelStorei = (pname, param) => {
      if (pname == 3317) {
        GL.unpackAlignment = param
      } else if (pname == 3314) {
        GL.unpackRowLength = param
      }
      GLctx.pixelStorei(pname, param)
    }

    var _emscripten_glPixelStorei = _glPixelStorei

    /** @suppress {duplicate } */ var _glPolygonOffset = (x0, x1) => GLctx.polygonOffset(x0, x1)

    var _emscripten_glPolygonOffset = _glPolygonOffset

    /** @suppress {duplicate } */ var _glQueryCounterEXT = (id, target) => {
      GLctx.disjointTimerQueryExt['queryCounterEXT'](GL.queries[id], target)
    }

    var _emscripten_glQueryCounterEXT = _glQueryCounterEXT

    var computeUnpackAlignedImageSize = (width, height, sizePerPixel) => {
      function roundedToNextMultipleOf(x, y) {
        return (x + y - 1) & -y
      }
      var plainRowSize = (GL.unpackRowLength || width) * sizePerPixel
      var alignedRowSize = roundedToNextMultipleOf(plainRowSize, GL.unpackAlignment)
      return height * alignedRowSize
    }

    var colorChannelsInGlTextureFormat = (format) => {
      // Micro-optimizations for size: map format to size by subtracting smallest
      // enum value (0x1902) from all values first.  Also omit the most common
      // size value (1) from the list, which is assumed by formats not on the
      // list.
      var colorChannels = {
        // 0x1902 /* GL_DEPTH_COMPONENT */ - 0x1902: 1,
        // 0x1906 /* GL_ALPHA */ - 0x1902: 1,
        5: 3,
        6: 4,
        // 0x1909 /* GL_LUMINANCE */ - 0x1902: 1,
        8: 2,
        29502: 3,
        29504: 4,
      }
      return colorChannels[format - 6402] || 1
    }

    var heapObjectForWebGLType = (type) => {
      // Micro-optimization for size: Subtract lowest GL enum number (0x1400/* GL_BYTE */) from type to compare
      // smaller values for the heap, for shorter generated code size.
      // Also the type HEAPU16 is not tested for explicitly, but any unrecognized type will return out HEAPU16.
      // (since most types are HEAPU16)
      type -= 5120
      if (type == 1) return GROWABLE_HEAP_U8()
      if (type == 4) return GROWABLE_HEAP_I32()
      if (type == 6) return GROWABLE_HEAP_F32()
      if (type == 5 || type == 28922) return GROWABLE_HEAP_U32()
      return GROWABLE_HEAP_U16()
    }

    var toTypedArrayIndex = (pointer, heap) => pointer >>> (31 - Math.clz32(heap.BYTES_PER_ELEMENT))

    var emscriptenWebGLGetTexPixelData = (type, format, width, height, pixels, internalFormat) => {
      var heap = heapObjectForWebGLType(type)
      var sizePerPixel = colorChannelsInGlTextureFormat(format) * heap.BYTES_PER_ELEMENT
      var bytes = computeUnpackAlignedImageSize(width, height, sizePerPixel)
      return heap.subarray(toTypedArrayIndex(pixels, heap), toTypedArrayIndex(pixels + bytes, heap))
    }

    /** @suppress {duplicate } */ var _glReadPixels = (
      x,
      y,
      width,
      height,
      format,
      type,
      pixels
    ) => {
      var pixelData = emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, format)
      if (!pixelData) {
        GL.recordError(1280)
        /*GL_INVALID_ENUM*/ return
      }
      GLctx.readPixels(x, y, width, height, format, type, pixelData)
    }

    var _emscripten_glReadPixels = _glReadPixels

    /** @suppress {duplicate } */ var _glReleaseShaderCompiler = () => {}

    // NOP (as allowed by GLES 2.0 spec)
    var _emscripten_glReleaseShaderCompiler = _glReleaseShaderCompiler

    /** @suppress {duplicate } */ var _glRenderbufferStorage = (x0, x1, x2, x3) =>
      GLctx.renderbufferStorage(x0, x1, x2, x3)

    var _emscripten_glRenderbufferStorage = _glRenderbufferStorage

    /** @suppress {duplicate } */ var _glSampleCoverage = (value, invert) => {
      GLctx.sampleCoverage(value, !!invert)
    }

    var _emscripten_glSampleCoverage = _glSampleCoverage

    /** @suppress {duplicate } */ var _glScissor = (x0, x1, x2, x3) => GLctx.scissor(x0, x1, x2, x3)

    var _emscripten_glScissor = _glScissor

    /** @suppress {duplicate } */ var _glShaderBinary = (
      count,
      shaders,
      binaryformat,
      binary,
      length
    ) => {
      GL.recordError(1280)
    }

    /*GL_INVALID_ENUM*/ var _emscripten_glShaderBinary = _glShaderBinary

    /** @suppress {duplicate } */ var _glShaderSource = (shader, count, string, length) => {
      var source = GL.getSource(shader, count, string, length)
      GLctx.shaderSource(GL.shaders[shader], source)
    }

    var _emscripten_glShaderSource = _glShaderSource

    /** @suppress {duplicate } */ var _glStencilFunc = (x0, x1, x2) => GLctx.stencilFunc(x0, x1, x2)

    var _emscripten_glStencilFunc = _glStencilFunc

    /** @suppress {duplicate } */ var _glStencilFuncSeparate = (x0, x1, x2, x3) =>
      GLctx.stencilFuncSeparate(x0, x1, x2, x3)

    var _emscripten_glStencilFuncSeparate = _glStencilFuncSeparate

    /** @suppress {duplicate } */ var _glStencilMask = (x0) => GLctx.stencilMask(x0)

    var _emscripten_glStencilMask = _glStencilMask

    /** @suppress {duplicate } */ var _glStencilMaskSeparate = (x0, x1) =>
      GLctx.stencilMaskSeparate(x0, x1)

    var _emscripten_glStencilMaskSeparate = _glStencilMaskSeparate

    /** @suppress {duplicate } */ var _glStencilOp = (x0, x1, x2) => GLctx.stencilOp(x0, x1, x2)

    var _emscripten_glStencilOp = _glStencilOp

    /** @suppress {duplicate } */ var _glStencilOpSeparate = (x0, x1, x2, x3) =>
      GLctx.stencilOpSeparate(x0, x1, x2, x3)

    var _emscripten_glStencilOpSeparate = _glStencilOpSeparate

    /** @suppress {duplicate } */ var _glTexImage2D = (
      target,
      level,
      internalFormat,
      width,
      height,
      border,
      format,
      type,
      pixels
    ) => {
      var pixelData = pixels
        ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, internalFormat)
        : null
      GLctx.texImage2D(
        target,
        level,
        internalFormat,
        width,
        height,
        border,
        format,
        type,
        pixelData
      )
    }

    var _emscripten_glTexImage2D = _glTexImage2D

    /** @suppress {duplicate } */ var _glTexParameterf = (x0, x1, x2) =>
      GLctx.texParameterf(x0, x1, x2)

    var _emscripten_glTexParameterf = _glTexParameterf

    /** @suppress {duplicate } */ var _glTexParameterfv = (target, pname, params) => {
      var param = GROWABLE_HEAP_F32()[params >> 2]
      GLctx.texParameterf(target, pname, param)
    }

    var _emscripten_glTexParameterfv = _glTexParameterfv

    /** @suppress {duplicate } */ var _glTexParameteri = (x0, x1, x2) =>
      GLctx.texParameteri(x0, x1, x2)

    var _emscripten_glTexParameteri = _glTexParameteri

    /** @suppress {duplicate } */ var _glTexParameteriv = (target, pname, params) => {
      var param = GROWABLE_HEAP_I32()[params >> 2]
      GLctx.texParameteri(target, pname, param)
    }

    var _emscripten_glTexParameteriv = _glTexParameteriv

    /** @suppress {duplicate } */ var _glTexSubImage2D = (
      target,
      level,
      xoffset,
      yoffset,
      width,
      height,
      format,
      type,
      pixels
    ) => {
      var pixelData = pixels
        ? emscriptenWebGLGetTexPixelData(type, format, width, height, pixels, 0)
        : null
      GLctx.texSubImage2D(target, level, xoffset, yoffset, width, height, format, type, pixelData)
    }

    var _emscripten_glTexSubImage2D = _glTexSubImage2D

    /** @suppress {duplicate } */ var _glUniform1f = (location, v0) => {
      GLctx.uniform1f(webglGetUniformLocation(location), v0)
    }

    var _emscripten_glUniform1f = _glUniform1f

    var miniTempWebGLFloatBuffers = []

    /** @suppress {duplicate } */ var _glUniform1fv = (location, count, value) => {
      if (count <= 288) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[count]
        for (var i = 0; i < count; ++i) {
          view[i] = GROWABLE_HEAP_F32()[(value + 4 * i) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 4) >> 2)
      }
      GLctx.uniform1fv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform1fv = _glUniform1fv

    /** @suppress {duplicate } */ var _glUniform1i = (location, v0) => {
      GLctx.uniform1i(webglGetUniformLocation(location), v0)
    }

    var _emscripten_glUniform1i = _glUniform1i

    var miniTempWebGLIntBuffers = []

    /** @suppress {duplicate } */ var _glUniform1iv = (location, count, value) => {
      if (count <= 288) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLIntBuffers[count]
        for (var i = 0; i < count; ++i) {
          view[i] = GROWABLE_HEAP_I32()[(value + 4 * i) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_I32().subarray(value >> 2, (value + count * 4) >> 2)
      }
      GLctx.uniform1iv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform1iv = _glUniform1iv

    /** @suppress {duplicate } */ var _glUniform2f = (location, v0, v1) => {
      GLctx.uniform2f(webglGetUniformLocation(location), v0, v1)
    }

    var _emscripten_glUniform2f = _glUniform2f

    /** @suppress {duplicate } */ var _glUniform2fv = (location, count, value) => {
      if (count <= 144) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[2 * count]
        for (var i = 0; i < 2 * count; i += 2) {
          view[i] = GROWABLE_HEAP_F32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_F32()[(value + (4 * i + 4)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 8) >> 2)
      }
      GLctx.uniform2fv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform2fv = _glUniform2fv

    /** @suppress {duplicate } */ var _glUniform2i = (location, v0, v1) => {
      GLctx.uniform2i(webglGetUniformLocation(location), v0, v1)
    }

    var _emscripten_glUniform2i = _glUniform2i

    /** @suppress {duplicate } */ var _glUniform2iv = (location, count, value) => {
      if (count <= 144) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLIntBuffers[2 * count]
        for (var i = 0; i < 2 * count; i += 2) {
          view[i] = GROWABLE_HEAP_I32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_I32()[(value + (4 * i + 4)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_I32().subarray(value >> 2, (value + count * 8) >> 2)
      }
      GLctx.uniform2iv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform2iv = _glUniform2iv

    /** @suppress {duplicate } */ var _glUniform3f = (location, v0, v1, v2) => {
      GLctx.uniform3f(webglGetUniformLocation(location), v0, v1, v2)
    }

    var _emscripten_glUniform3f = _glUniform3f

    /** @suppress {duplicate } */ var _glUniform3fv = (location, count, value) => {
      if (count <= 96) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[3 * count]
        for (var i = 0; i < 3 * count; i += 3) {
          view[i] = GROWABLE_HEAP_F32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_F32()[(value + (4 * i + 4)) >> 2]
          view[i + 2] = GROWABLE_HEAP_F32()[(value + (4 * i + 8)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 12) >> 2)
      }
      GLctx.uniform3fv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform3fv = _glUniform3fv

    /** @suppress {duplicate } */ var _glUniform3i = (location, v0, v1, v2) => {
      GLctx.uniform3i(webglGetUniformLocation(location), v0, v1, v2)
    }

    var _emscripten_glUniform3i = _glUniform3i

    /** @suppress {duplicate } */ var _glUniform3iv = (location, count, value) => {
      if (count <= 96) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLIntBuffers[3 * count]
        for (var i = 0; i < 3 * count; i += 3) {
          view[i] = GROWABLE_HEAP_I32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_I32()[(value + (4 * i + 4)) >> 2]
          view[i + 2] = GROWABLE_HEAP_I32()[(value + (4 * i + 8)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_I32().subarray(value >> 2, (value + count * 12) >> 2)
      }
      GLctx.uniform3iv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform3iv = _glUniform3iv

    /** @suppress {duplicate } */ var _glUniform4f = (location, v0, v1, v2, v3) => {
      GLctx.uniform4f(webglGetUniformLocation(location), v0, v1, v2, v3)
    }

    var _emscripten_glUniform4f = _glUniform4f

    /** @suppress {duplicate } */ var _glUniform4fv = (location, count, value) => {
      if (count <= 72) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[4 * count]
        // hoist the heap out of the loop for size and for pthreads+growth.
        var heap = GROWABLE_HEAP_F32()
        value = value >> 2
        for (var i = 0; i < 4 * count; i += 4) {
          var dst = value + i
          view[i] = heap[dst]
          view[i + 1] = heap[dst + 1]
          view[i + 2] = heap[dst + 2]
          view[i + 3] = heap[dst + 3]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 16) >> 2)
      }
      GLctx.uniform4fv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform4fv = _glUniform4fv

    /** @suppress {duplicate } */ var _glUniform4i = (location, v0, v1, v2, v3) => {
      GLctx.uniform4i(webglGetUniformLocation(location), v0, v1, v2, v3)
    }

    var _emscripten_glUniform4i = _glUniform4i

    /** @suppress {duplicate } */ var _glUniform4iv = (location, count, value) => {
      if (count <= 72) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLIntBuffers[4 * count]
        for (var i = 0; i < 4 * count; i += 4) {
          view[i] = GROWABLE_HEAP_I32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_I32()[(value + (4 * i + 4)) >> 2]
          view[i + 2] = GROWABLE_HEAP_I32()[(value + (4 * i + 8)) >> 2]
          view[i + 3] = GROWABLE_HEAP_I32()[(value + (4 * i + 12)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_I32().subarray(value >> 2, (value + count * 16) >> 2)
      }
      GLctx.uniform4iv(webglGetUniformLocation(location), view)
    }

    var _emscripten_glUniform4iv = _glUniform4iv

    /** @suppress {duplicate } */ var _glUniformMatrix2fv = (location, count, transpose, value) => {
      if (count <= 72) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[4 * count]
        for (var i = 0; i < 4 * count; i += 4) {
          view[i] = GROWABLE_HEAP_F32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_F32()[(value + (4 * i + 4)) >> 2]
          view[i + 2] = GROWABLE_HEAP_F32()[(value + (4 * i + 8)) >> 2]
          view[i + 3] = GROWABLE_HEAP_F32()[(value + (4 * i + 12)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 16) >> 2)
      }
      GLctx.uniformMatrix2fv(webglGetUniformLocation(location), !!transpose, view)
    }

    var _emscripten_glUniformMatrix2fv = _glUniformMatrix2fv

    /** @suppress {duplicate } */ var _glUniformMatrix3fv = (location, count, transpose, value) => {
      if (count <= 32) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[9 * count]
        for (var i = 0; i < 9 * count; i += 9) {
          view[i] = GROWABLE_HEAP_F32()[(value + 4 * i) >> 2]
          view[i + 1] = GROWABLE_HEAP_F32()[(value + (4 * i + 4)) >> 2]
          view[i + 2] = GROWABLE_HEAP_F32()[(value + (4 * i + 8)) >> 2]
          view[i + 3] = GROWABLE_HEAP_F32()[(value + (4 * i + 12)) >> 2]
          view[i + 4] = GROWABLE_HEAP_F32()[(value + (4 * i + 16)) >> 2]
          view[i + 5] = GROWABLE_HEAP_F32()[(value + (4 * i + 20)) >> 2]
          view[i + 6] = GROWABLE_HEAP_F32()[(value + (4 * i + 24)) >> 2]
          view[i + 7] = GROWABLE_HEAP_F32()[(value + (4 * i + 28)) >> 2]
          view[i + 8] = GROWABLE_HEAP_F32()[(value + (4 * i + 32)) >> 2]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 36) >> 2)
      }
      GLctx.uniformMatrix3fv(webglGetUniformLocation(location), !!transpose, view)
    }

    var _emscripten_glUniformMatrix3fv = _glUniformMatrix3fv

    /** @suppress {duplicate } */ var _glUniformMatrix4fv = (location, count, transpose, value) => {
      if (count <= 18) {
        // avoid allocation when uploading few enough uniforms
        var view = miniTempWebGLFloatBuffers[16 * count]
        // hoist the heap out of the loop for size and for pthreads+growth.
        var heap = GROWABLE_HEAP_F32()
        value = value >> 2
        for (var i = 0; i < 16 * count; i += 16) {
          var dst = value + i
          view[i] = heap[dst]
          view[i + 1] = heap[dst + 1]
          view[i + 2] = heap[dst + 2]
          view[i + 3] = heap[dst + 3]
          view[i + 4] = heap[dst + 4]
          view[i + 5] = heap[dst + 5]
          view[i + 6] = heap[dst + 6]
          view[i + 7] = heap[dst + 7]
          view[i + 8] = heap[dst + 8]
          view[i + 9] = heap[dst + 9]
          view[i + 10] = heap[dst + 10]
          view[i + 11] = heap[dst + 11]
          view[i + 12] = heap[dst + 12]
          view[i + 13] = heap[dst + 13]
          view[i + 14] = heap[dst + 14]
          view[i + 15] = heap[dst + 15]
        }
      } else {
        var view = GROWABLE_HEAP_F32().subarray(value >> 2, (value + count * 64) >> 2)
      }
      GLctx.uniformMatrix4fv(webglGetUniformLocation(location), !!transpose, view)
    }

    var _emscripten_glUniformMatrix4fv = _glUniformMatrix4fv

    /** @suppress {duplicate } */ var _glUseProgram = (program) => {
      program = GL.programs[program]
      GLctx.useProgram(program)
      // Record the currently active program so that we can access the uniform
      // mapping table of that program.
      GLctx.currentProgram = program
    }

    var _emscripten_glUseProgram = _glUseProgram

    /** @suppress {duplicate } */ var _glValidateProgram = (program) => {
      GLctx.validateProgram(GL.programs[program])
    }

    var _emscripten_glValidateProgram = _glValidateProgram

    /** @suppress {duplicate } */ var _glVertexAttrib1f = (x0, x1) => GLctx.vertexAttrib1f(x0, x1)

    var _emscripten_glVertexAttrib1f = _glVertexAttrib1f

    /** @suppress {duplicate } */ var _glVertexAttrib1fv = (index, v) => {
      GLctx.vertexAttrib1f(index, GROWABLE_HEAP_F32()[v >> 2])
    }

    var _emscripten_glVertexAttrib1fv = _glVertexAttrib1fv

    /** @suppress {duplicate } */ var _glVertexAttrib2f = (x0, x1, x2) =>
      GLctx.vertexAttrib2f(x0, x1, x2)

    var _emscripten_glVertexAttrib2f = _glVertexAttrib2f

    /** @suppress {duplicate } */ var _glVertexAttrib2fv = (index, v) => {
      GLctx.vertexAttrib2f(index, GROWABLE_HEAP_F32()[v >> 2], GROWABLE_HEAP_F32()[(v + 4) >> 2])
    }

    var _emscripten_glVertexAttrib2fv = _glVertexAttrib2fv

    /** @suppress {duplicate } */ var _glVertexAttrib3f = (x0, x1, x2, x3) =>
      GLctx.vertexAttrib3f(x0, x1, x2, x3)

    var _emscripten_glVertexAttrib3f = _glVertexAttrib3f

    /** @suppress {duplicate } */ var _glVertexAttrib3fv = (index, v) => {
      GLctx.vertexAttrib3f(
        index,
        GROWABLE_HEAP_F32()[v >> 2],
        GROWABLE_HEAP_F32()[(v + 4) >> 2],
        GROWABLE_HEAP_F32()[(v + 8) >> 2]
      )
    }

    var _emscripten_glVertexAttrib3fv = _glVertexAttrib3fv

    /** @suppress {duplicate } */ var _glVertexAttrib4f = (x0, x1, x2, x3, x4) =>
      GLctx.vertexAttrib4f(x0, x1, x2, x3, x4)

    var _emscripten_glVertexAttrib4f = _glVertexAttrib4f

    /** @suppress {duplicate } */ var _glVertexAttrib4fv = (index, v) => {
      GLctx.vertexAttrib4f(
        index,
        GROWABLE_HEAP_F32()[v >> 2],
        GROWABLE_HEAP_F32()[(v + 4) >> 2],
        GROWABLE_HEAP_F32()[(v + 8) >> 2],
        GROWABLE_HEAP_F32()[(v + 12) >> 2]
      )
    }

    var _emscripten_glVertexAttrib4fv = _glVertexAttrib4fv

    /** @suppress {duplicate } */ var _glVertexAttribDivisor = (index, divisor) => {
      GLctx.vertexAttribDivisor(index, divisor)
    }

    /** @suppress {duplicate } */ var _glVertexAttribDivisorANGLE = _glVertexAttribDivisor

    var _emscripten_glVertexAttribDivisorANGLE = _glVertexAttribDivisorANGLE

    /** @suppress {duplicate } */ var _glVertexAttribPointer = (
      index,
      size,
      type,
      normalized,
      stride,
      ptr
    ) => {
      GLctx.vertexAttribPointer(index, size, type, !!normalized, stride, ptr)
    }

    var _emscripten_glVertexAttribPointer = _glVertexAttribPointer

    /** @suppress {duplicate } */ var _glViewport = (x0, x1, x2, x3) =>
      GLctx.viewport(x0, x1, x2, x3)

    var _emscripten_glViewport = _glViewport

    var getHeapMax = () =>
      // Stay one Wasm page short of 4GB: while e.g. Chrome is able to allocate
      // full 4GB Wasm memories, the size will wrap back to 0 bytes in Wasm side
      // for any code that deals with heap sizes, which would require special
      // casing all heap size related code to treat 0 specially.
      2147483648

    var growMemory = (size) => {
      var b = wasmMemory.buffer
      var pages = (size - b.byteLength + 65535) / 65536
      try {
        // round size grow request up to wasm page size (fixed 64KB per spec)
        wasmMemory.grow(pages)
        // .grow() takes a delta compared to the previous size
        updateMemoryViews()
        return 1
      } /*success*/ catch (e) {}
    }

    // implicit 0 return to save code size (caller will cast "undefined" into 0
    // anyhow)
    var _emscripten_resize_heap = (requestedSize) => {
      var oldSize = GROWABLE_HEAP_U8().length
      // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
      requestedSize >>>= 0
      // With multithreaded builds, races can happen (another thread might increase the size
      // in between), so return a failure, and let the caller retry.
      if (requestedSize <= oldSize) {
        return false
      }
      // Memory resize rules:
      // 1.  Always increase heap size to at least the requested size, rounded up
      //     to next page multiple.
      // 2a. If MEMORY_GROWTH_LINEAR_STEP == -1, excessively resize the heap
      //     geometrically: increase the heap size according to
      //     MEMORY_GROWTH_GEOMETRIC_STEP factor (default +20%), At most
      //     overreserve by MEMORY_GROWTH_GEOMETRIC_CAP bytes (default 96MB).
      // 2b. If MEMORY_GROWTH_LINEAR_STEP != -1, excessively resize the heap
      //     linearly: increase the heap size by at least
      //     MEMORY_GROWTH_LINEAR_STEP bytes.
      // 3.  Max size for the heap is capped at 2048MB-WASM_PAGE_SIZE, or by
      //     MAXIMUM_MEMORY, or by ASAN limit, depending on which is smallest
      // 4.  If we were unable to allocate as much memory, it may be due to
      //     over-eager decision to excessively reserve due to (3) above.
      //     Hence if an allocation fails, cut down on the amount of excess
      //     growth, in an attempt to succeed to perform a smaller allocation.
      // A limit is set for how much we can grow. We should not exceed that
      // (the wasm binary specifies it, so if we tried, we'd fail anyhow).
      var maxHeapSize = getHeapMax()
      if (requestedSize > maxHeapSize) {
        return false
      }
      var alignUp = (x, multiple) => x + ((multiple - (x % multiple)) % multiple)
      // Loop through potential heap size increases. If we attempt a too eager
      // reservation that fails, cut down on the attempted size and reserve a
      // smaller bump instead. (max 3 times, chosen somewhat arbitrarily)
      for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
        var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown)
        // ensure geometric growth
        // but limit overreserving (default to capping at +96MB overgrowth at most)
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296)
        var newSize = Math.min(
          maxHeapSize,
          alignUp(Math.max(requestedSize, overGrownHeapSize), 65536)
        )
        var replacement = growMemory(newSize)
        if (replacement) {
          return true
        }
      }
      return false
    }

    /** @returns {number} */ var convertFrameToPC = (frame) => {
      var match
      if ((match = /\bwasm-function\[\d+\]:(0x[0-9a-f]+)/.exec(frame))) {
        // some engines give the binary offset directly, so we use that as return address
        return +match[1]
      } else if ((match = /\bwasm-function\[(\d+)\]:(\d+)/.exec(frame))) {
        // other engines only give function index and offset in the function,
        // so we try using the offset converter. If that doesn't work,
        // we pack index and offset into a "return address"
        return wasmOffsetConverter.convert(+match[1], +match[2])
      } else if ((match = /:(\d+):\d+(?:\)|$)/.exec(frame))) {
        // If we are in js, we can use the js line number as the "return address".
        // This should work for wasm2js.  We tag the high bit to distinguish this
        // from wasm addresses.
        return 2147483648 | +match[1]
      }
      // return 0 if we can't find any
      return 0
    }

    function jsStackTrace() {
      return new Error().stack.toString()
    }

    var _emscripten_return_address = (level) => {
      var callstack = jsStackTrace().split('\n')
      if (callstack[0] == 'Error') {
        callstack.shift()
      }
      // skip this function and the caller to get caller's return address
      var caller = callstack[level + 3]
      return convertFrameToPC(caller)
    }

    /** @suppress {checkTypes} */ function _emscripten_sample_gamepad_data() {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(13, 0, 1)
      try {
        if (navigator.getGamepads)
          return (JSEvents.lastGamepadState = navigator.getGamepads()) ? 0 : -1
      } catch (e) {
        navigator.getGamepads = null
      }
      // Disable getGamepads() so that it won't be attempted to be used again.
      return -1
    }

    var findCanvasEventTarget = findEventTarget

    var setCanvasElementSizeCallingThread = (target, width, height) => {
      var canvas = findCanvasEventTarget(target)
      if (!canvas) return -4
      if (!canvas.controlTransferredOffscreen) {
        var autoResizeViewport = false
        if (canvas.GLctxObject?.GLctx) {
          var prevViewport = canvas.GLctxObject.GLctx.getParameter(2978)
          // TODO: Perhaps autoResizeViewport should only be true if FBO 0 is currently active?
          autoResizeViewport =
            prevViewport[0] === 0 &&
            prevViewport[1] === 0 &&
            prevViewport[2] === canvas.width &&
            prevViewport[3] === canvas.height
        }
        canvas.width = width
        canvas.height = height
        if (autoResizeViewport) {
          // TODO: Add -sCANVAS_RESIZE_SETS_GL_VIEWPORT=0/1 option (default=1). This is commonly done and several graphics engines depend on this,
          // but this can be quite disruptive.
          canvas.GLctxObject.GLctx.viewport(0, 0, width, height)
        }
      } else {
        return -4
      }
      return 0
    }

    function setCanvasElementSizeMainThread(target, width, height) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(14, 0, 1, target, width, height)
      return setCanvasElementSizeCallingThread(target, width, height)
    }

    var _emscripten_set_canvas_element_size = (target, width, height) => {
      var canvas = findCanvasEventTarget(target)
      if (canvas) {
        return setCanvasElementSizeCallingThread(target, width, height)
      }
      return setCanvasElementSizeMainThread(target, width, height)
    }

    var fillMouseEventData = (eventStruct, e, target) => {
      GROWABLE_HEAP_F64()[eventStruct >> 3] = e.timeStamp
      var idx = eventStruct >> 2
      GROWABLE_HEAP_I32()[idx + 2] = e.screenX
      GROWABLE_HEAP_I32()[idx + 3] = e.screenY
      GROWABLE_HEAP_I32()[idx + 4] = e.clientX
      GROWABLE_HEAP_I32()[idx + 5] = e.clientY
      GROWABLE_HEAP_I8()[idx + 24] = e.ctrlKey
      GROWABLE_HEAP_I8()[idx + 25] = e.shiftKey
      GROWABLE_HEAP_I8()[idx + 26] = e.altKey
      GROWABLE_HEAP_I8()[idx + 27] = e.metaKey
      GROWABLE_HEAP_I16()[idx * 2 + 14] = e.button
      GROWABLE_HEAP_I16()[idx * 2 + 15] = e.buttons
      GROWABLE_HEAP_I32()[idx + 8] = e['movementX']
      GROWABLE_HEAP_I32()[idx + 9] = e['movementY']
      // Note: rect contains doubles (truncated to placate SAFE_HEAP, which is the same behaviour when writing to HEAP32 anyway)
      var rect = getBoundingClientRect(target)
      GROWABLE_HEAP_I32()[idx + 10] = e.clientX - (rect.left | 0)
      GROWABLE_HEAP_I32()[idx + 11] = e.clientY - (rect.top | 0)
    }

    var registerMouseEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      targetThread = JSEvents.getTargetThreadForEventCallback(targetThread)
      if (!JSEvents.mouseEvent) JSEvents.mouseEvent = _malloc(64)
      target = findEventTarget(target)
      var mouseEventHandlerFunc = (e = event) => {
        // TODO: Make this access thread safe, or this could update live while app is reading it.
        fillMouseEventData(JSEvents.mouseEvent, e, target)
        if (targetThread) {
          var mouseEventData = _malloc(64)
          // This allocated block is passed as satellite data to the proxied function call, so the call frees up the data block when done.
          fillMouseEventData(mouseEventData, e, target)
          __emscripten_run_callback_on_thread(
            targetThread,
            callbackfunc,
            eventTypeId,
            mouseEventData,
            userData
          )
        } else if (
          ((a1, a2, a3) => dynCall_iiii(callbackfunc, a1, a2, a3))(
            eventTypeId,
            JSEvents.mouseEvent,
            userData
          )
        )
          e.preventDefault()
      }
      var eventHandler = {
        target: target,
        allowsDeferredCalls:
          eventTypeString != 'mousemove' &&
          eventTypeString != 'mouseenter' &&
          eventTypeString != 'mouseleave',
        // Mouse move events do not allow fullscreen/pointer lock requests to be handled in them!
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: mouseEventHandlerFunc,
        useCapture: useCapture,
      }
      return JSEvents.registerOrRemoveHandler(eventHandler)
    }

    function _emscripten_set_click_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(15, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        4,
        'click',
        targetThread
      )
    }

    var fillFullscreenChangeEventData = (eventStruct) => {
      var fullscreenElement =
        document.fullscreenElement ||
        document.mozFullScreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement
      var isFullscreen = !!fullscreenElement
      // Assigning a boolean to HEAP32 with expected type coercion.
      /** @suppress{checkTypes} */ GROWABLE_HEAP_I8()[eventStruct] = isFullscreen
      GROWABLE_HEAP_I8()[eventStruct + 1] = JSEvents.fullscreenEnabled()
      // If transitioning to fullscreen, report info about the element that is now fullscreen.
      // If transitioning to windowed mode, report info about the element that just was fullscreen.
      var reportedElement = isFullscreen ? fullscreenElement : JSEvents.previousFullscreenElement
      var nodeName = JSEvents.getNodeNameForTarget(reportedElement)
      var id = reportedElement?.id || ''
      stringToUTF8(nodeName, eventStruct + 2, 128)
      stringToUTF8(id, eventStruct + 130, 128)
      GROWABLE_HEAP_I32()[(eventStruct + 260) >> 2] = reportedElement
        ? reportedElement.clientWidth
        : 0
      GROWABLE_HEAP_I32()[(eventStruct + 264) >> 2] = reportedElement
        ? reportedElement.clientHeight
        : 0
      GROWABLE_HEAP_I32()[(eventStruct + 268) >> 2] = screen.width
      GROWABLE_HEAP_I32()[(eventStruct + 272) >> 2] = screen.height
      if (isFullscreen) {
        JSEvents.previousFullscreenElement = fullscreenElement
      }
    }

    var registerFullscreenChangeEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      targetThread = JSEvents.getTargetThreadForEventCallback(targetThread)
      if (!JSEvents.fullscreenChangeEvent) JSEvents.fullscreenChangeEvent = _malloc(276)
      var fullscreenChangeEventhandlerFunc = (e = event) => {
        var fullscreenChangeEvent = targetThread ? _malloc(276) : JSEvents.fullscreenChangeEvent
        fillFullscreenChangeEventData(fullscreenChangeEvent)
        if (targetThread)
          __emscripten_run_callback_on_thread(
            targetThread,
            callbackfunc,
            eventTypeId,
            fullscreenChangeEvent,
            userData
          )
        else if (
          ((a1, a2, a3) => dynCall_iiii(callbackfunc, a1, a2, a3))(
            eventTypeId,
            fullscreenChangeEvent,
            userData
          )
        )
          e.preventDefault()
      }
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: fullscreenChangeEventhandlerFunc,
        useCapture: useCapture,
      }
      return JSEvents.registerOrRemoveHandler(eventHandler)
    }

    function _emscripten_set_fullscreenchange_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(16, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      if (!JSEvents.fullscreenEnabled()) return -1
      target = findEventTarget(target)
      if (!target) return -4
      // Unprefixed Fullscreen API shipped in Chromium 71 (https://bugs.chromium.org/p/chromium/issues/detail?id=383813)
      // As of Safari 13.0.3 on macOS Catalina 10.15.1 still ships with prefixed webkitfullscreenchange. TODO: revisit this check once Safari ships unprefixed version.
      registerFullscreenChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        19,
        'webkitfullscreenchange',
        targetThread
      )
      return registerFullscreenChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        19,
        'fullscreenchange',
        targetThread
      )
    }

    var registerGamepadEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      targetThread = JSEvents.getTargetThreadForEventCallback(targetThread)
      if (!JSEvents.gamepadEvent) JSEvents.gamepadEvent = _malloc(1240)
      var gamepadEventHandlerFunc = (e = event) => {
        var gamepadEvent = targetThread ? _malloc(1240) : JSEvents.gamepadEvent
        fillGamepadEventData(gamepadEvent, e['gamepad'])
        if (targetThread)
          __emscripten_run_callback_on_thread(
            targetThread,
            callbackfunc,
            eventTypeId,
            gamepadEvent,
            userData
          )
        else if (
          ((a1, a2, a3) => dynCall_iiii(callbackfunc, a1, a2, a3))(
            eventTypeId,
            gamepadEvent,
            userData
          )
        )
          e.preventDefault()
      }
      var eventHandler = {
        target: findEventTarget(target),
        allowsDeferredCalls: true,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: gamepadEventHandlerFunc,
        useCapture: useCapture,
      }
      return JSEvents.registerOrRemoveHandler(eventHandler)
    }

    function _emscripten_set_gamepadconnected_callback_on_thread(
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(17, 0, 1, userData, useCapture, callbackfunc, targetThread)
      if (_emscripten_sample_gamepad_data()) return -1
      return registerGamepadEventCallback(
        2,
        userData,
        useCapture,
        callbackfunc,
        26,
        'gamepadconnected',
        targetThread
      )
    }

    function _emscripten_set_gamepaddisconnected_callback_on_thread(
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(18, 0, 1, userData, useCapture, callbackfunc, targetThread)
      if (_emscripten_sample_gamepad_data()) return -1
      return registerGamepadEventCallback(
        2,
        userData,
        useCapture,
        callbackfunc,
        27,
        'gamepaddisconnected',
        targetThread
      )
    }

    function _emscripten_set_mousemove_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(19, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerMouseEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        8,
        'mousemove',
        targetThread
      )
    }

    var fillPointerlockChangeEventData = (eventStruct) => {
      var pointerLockElement =
        document.pointerLockElement ||
        document.mozPointerLockElement ||
        document.webkitPointerLockElement ||
        document.msPointerLockElement
      var isPointerlocked = !!pointerLockElement
      // Assigning a boolean to HEAP32 with expected type coercion.
      /** @suppress{checkTypes} */ GROWABLE_HEAP_I8()[eventStruct] = isPointerlocked
      var nodeName = JSEvents.getNodeNameForTarget(pointerLockElement)
      var id = pointerLockElement?.id || ''
      stringToUTF8(nodeName, eventStruct + 1, 128)
      stringToUTF8(id, eventStruct + 129, 128)
    }

    var registerPointerlockChangeEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      targetThread = JSEvents.getTargetThreadForEventCallback(targetThread)
      if (!JSEvents.pointerlockChangeEvent) JSEvents.pointerlockChangeEvent = _malloc(257)
      var pointerlockChangeEventHandlerFunc = (e = event) => {
        var pointerlockChangeEvent = targetThread ? _malloc(257) : JSEvents.pointerlockChangeEvent
        fillPointerlockChangeEventData(pointerlockChangeEvent)
        if (targetThread)
          __emscripten_run_callback_on_thread(
            targetThread,
            callbackfunc,
            eventTypeId,
            pointerlockChangeEvent,
            userData
          )
        else if (
          ((a1, a2, a3) => dynCall_iiii(callbackfunc, a1, a2, a3))(
            eventTypeId,
            pointerlockChangeEvent,
            userData
          )
        )
          e.preventDefault()
      }
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: pointerlockChangeEventHandlerFunc,
        useCapture: useCapture,
      }
      return JSEvents.registerOrRemoveHandler(eventHandler)
    }

    /** @suppress {missingProperties} */ function _emscripten_set_pointerlockchange_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(20, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      // TODO: Currently not supported in pthreads or in --proxy-to-worker mode. (In pthreads mode, document object is not defined)
      if (
        !document ||
        !document.body ||
        (!document.body.requestPointerLock &&
          !document.body.mozRequestPointerLock &&
          !document.body.webkitRequestPointerLock &&
          !document.body.msRequestPointerLock)
      ) {
        return -1
      }
      target = findEventTarget(target)
      if (!target) return -4
      registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        'mozpointerlockchange',
        targetThread
      )
      registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        'webkitpointerlockchange',
        targetThread
      )
      registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        'mspointerlockchange',
        targetThread
      )
      return registerPointerlockChangeEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        20,
        'pointerlockchange',
        targetThread
      )
    }

    var registerUiEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      targetThread = JSEvents.getTargetThreadForEventCallback(targetThread)
      if (!JSEvents.uiEvent) JSEvents.uiEvent = _malloc(36)
      target = findEventTarget(target)
      var uiEventHandlerFunc = (e = event) => {
        if (e.target != target) {
          // Never take ui events such as scroll via a 'bubbled' route, but always from the direct element that
          // was targeted. Otherwise e.g. if app logs a message in response to a page scroll, the Emscripten log
          // message box could cause to scroll, generating a new (bubbled) scroll message, causing a new log print,
          // causing a new scroll, etc..
          return
        }
        var b = document.body
        // Take document.body to a variable, Closure compiler does not outline access to it on its own.
        if (!b) {
          // During a page unload 'body' can be null, with "Cannot read property 'clientWidth' of null" being thrown
          return
        }
        var uiEvent = targetThread ? _malloc(36) : JSEvents.uiEvent
        GROWABLE_HEAP_I32()[uiEvent >> 2] = 0
        // always zero for resize and scroll
        GROWABLE_HEAP_I32()[(uiEvent + 4) >> 2] = b.clientWidth
        GROWABLE_HEAP_I32()[(uiEvent + 8) >> 2] = b.clientHeight
        GROWABLE_HEAP_I32()[(uiEvent + 12) >> 2] = innerWidth
        GROWABLE_HEAP_I32()[(uiEvent + 16) >> 2] = innerHeight
        GROWABLE_HEAP_I32()[(uiEvent + 20) >> 2] = outerWidth
        GROWABLE_HEAP_I32()[(uiEvent + 24) >> 2] = outerHeight
        GROWABLE_HEAP_I32()[(uiEvent + 28) >> 2] = pageXOffset | 0
        // scroll offsets are float
        GROWABLE_HEAP_I32()[(uiEvent + 32) >> 2] = pageYOffset | 0
        if (targetThread)
          __emscripten_run_callback_on_thread(
            targetThread,
            callbackfunc,
            eventTypeId,
            uiEvent,
            userData
          )
        else if (
          ((a1, a2, a3) => dynCall_iiii(callbackfunc, a1, a2, a3))(eventTypeId, uiEvent, userData)
        )
          e.preventDefault()
      }
      var eventHandler = {
        target: target,
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: uiEventHandlerFunc,
        useCapture: useCapture,
      }
      return JSEvents.registerOrRemoveHandler(eventHandler)
    }

    function _emscripten_set_resize_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(21, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerUiEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        10,
        'resize',
        targetThread
      )
    }

    var registerTouchEventCallback = (
      target,
      userData,
      useCapture,
      callbackfunc,
      eventTypeId,
      eventTypeString,
      targetThread
    ) => {
      targetThread = JSEvents.getTargetThreadForEventCallback(targetThread)
      if (!JSEvents.touchEvent) JSEvents.touchEvent = _malloc(1552)
      target = findEventTarget(target)
      var touchEventHandlerFunc = (e) => {
        var t,
          touches = {},
          et = e.touches
        // To ease marshalling different kinds of touches that browser reports (all touches are listed in e.touches,
        // only changed touches in e.changedTouches, and touches on target at a.targetTouches), mark a boolean in
        // each Touch object so that we can later loop only once over all touches we see to marshall over to Wasm.
        for (var i = 0; i < et.length; ++i) {
          t = et[i]
          // Browser might recycle the generated Touch objects between each frame (Firefox on Android), so reset any
          // changed/target states we may have set from previous frame.
          t.isChanged = t.onTarget = 0
          touches[t.identifier] = t
        }
        // Mark which touches are part of the changedTouches list.
        for (var i = 0; i < e.changedTouches.length; ++i) {
          t = e.changedTouches[i]
          t.isChanged = 1
          touches[t.identifier] = t
        }
        // Mark which touches are part of the targetTouches list.
        for (var i = 0; i < e.targetTouches.length; ++i) {
          touches[e.targetTouches[i].identifier].onTarget = 1
        }
        var touchEvent = targetThread ? _malloc(1552) : JSEvents.touchEvent
        GROWABLE_HEAP_F64()[touchEvent >> 3] = e.timeStamp
        var idx = touchEvent >> 2
        // Pre-shift the ptr to index to HEAP32 to save code size
        GROWABLE_HEAP_I8()[idx + 12] = e.ctrlKey
        GROWABLE_HEAP_I8()[idx + 13] = e.shiftKey
        GROWABLE_HEAP_I8()[idx + 14] = e.altKey
        GROWABLE_HEAP_I8()[idx + 15] = e.metaKey
        idx += 4
        // Advance to the start of the touch array.
        var targetRect = getBoundingClientRect(target)
        var numTouches = 0
        for (var i in touches) {
          t = touches[i]
          GROWABLE_HEAP_I32()[idx + 0] = t.identifier
          GROWABLE_HEAP_I32()[idx + 1] = t.screenX
          GROWABLE_HEAP_I32()[idx + 2] = t.screenY
          GROWABLE_HEAP_I32()[idx + 3] = t.clientX
          GROWABLE_HEAP_I32()[idx + 4] = t.clientY
          GROWABLE_HEAP_I32()[idx + 5] = t.pageX
          GROWABLE_HEAP_I32()[idx + 6] = t.pageY
          GROWABLE_HEAP_I8()[idx + 28] = t.isChanged
          GROWABLE_HEAP_I8()[idx + 29] = t.onTarget
          GROWABLE_HEAP_I32()[idx + 8] = t.clientX - (targetRect.left | 0)
          GROWABLE_HEAP_I32()[idx + 9] = t.clientY - (targetRect.top | 0)
          idx += 12
          if (++numTouches > 31) {
            break
          }
        }
        GROWABLE_HEAP_I32()[(touchEvent + 8) >> 2] = numTouches
        if (targetThread)
          __emscripten_run_callback_on_thread(
            targetThread,
            callbackfunc,
            eventTypeId,
            touchEvent,
            userData
          )
        else if (
          ((a1, a2, a3) => dynCall_iiii(callbackfunc, a1, a2, a3))(
            eventTypeId,
            touchEvent,
            userData
          )
        )
          e.preventDefault()
      }
      var eventHandler = {
        target: target,
        allowsDeferredCalls: eventTypeString == 'touchstart' || eventTypeString == 'touchend',
        eventTypeString: eventTypeString,
        callbackfunc: callbackfunc,
        handlerFunc: touchEventHandlerFunc,
        useCapture: useCapture,
      }
      return JSEvents.registerOrRemoveHandler(eventHandler)
    }

    function _emscripten_set_touchcancel_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(22, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        25,
        'touchcancel',
        targetThread
      )
    }

    function _emscripten_set_touchend_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(23, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        23,
        'touchend',
        targetThread
      )
    }

    function _emscripten_set_touchmove_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(24, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        24,
        'touchmove',
        targetThread
      )
    }

    function _emscripten_set_touchstart_callback_on_thread(
      target,
      userData,
      useCapture,
      callbackfunc,
      targetThread
    ) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(25, 0, 1, target, userData, useCapture, callbackfunc, targetThread)
      return registerTouchEventCallback(
        target,
        userData,
        useCapture,
        callbackfunc,
        22,
        'touchstart',
        targetThread
      )
    }

    var _emscripten_set_main_loop_timing = (mode, value) => {
      Browser.mainLoop.timingMode = mode
      Browser.mainLoop.timingValue = value
      if (!Browser.mainLoop.func) {
        return 1
      }
      // Return non-zero on failure, can't set timing mode when there is no main loop.
      if (!Browser.mainLoop.running) {
        runtimeKeepalivePush()
        Browser.mainLoop.running = true
      }
      if (mode == 0) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
          var timeUntilNextTick =
            Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0
          setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
        }
        // doing this each time means that on exception, we stop
        Browser.mainLoop.method = 'timeout'
      } else if (mode == 1) {
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
          Browser.requestAnimationFrame(Browser.mainLoop.runner)
        }
        Browser.mainLoop.method = 'rAF'
      } else if (mode == 2) {
        if (typeof Browser.setImmediate == 'undefined') {
          if (typeof setImmediate == 'undefined') {
            // Emulate setImmediate. (note: not a complete polyfill, we don't emulate clearImmediate() to keep code size to minimum, since not needed)
            var setImmediates = []
            var emscriptenMainLoopMessageId = 'setimmediate'
            /** @param {Event} event */ var Browser_setImmediate_messageHandler = (event) => {
              // When called in current thread or Worker, the main loop ID is structured slightly different to accommodate for --proxy-to-worker runtime listening to Worker events,
              // so check for both cases.
              if (
                event.data === emscriptenMainLoopMessageId ||
                event.data.target === emscriptenMainLoopMessageId
              ) {
                event.stopPropagation()
                setImmediates.shift()()
              }
            }
            addEventListener('message', Browser_setImmediate_messageHandler, true)
            Browser.setImmediate = /** @type{function(function(): ?, ...?): number} */ (
              function Browser_emulated_setImmediate(func) {
                setImmediates.push(func)
                if (ENVIRONMENT_IS_WORKER) {
                  Module['setImmediates'] ??= []
                  Module['setImmediates'].push(func)
                  postMessage({
                    target: emscriptenMainLoopMessageId,
                  })
                } // In --proxy-to-worker, route the message via proxyClient.js
                else postMessage(emscriptenMainLoopMessageId, '*')
              }
            )
          } else {
            Browser.setImmediate = setImmediate
          }
        }
        Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
          Browser.setImmediate(Browser.mainLoop.runner)
        }
        Browser.mainLoop.method = 'immediate'
      }
      return 0
    }

    var runtimeKeepalivePop = () => {
      runtimeKeepaliveCounter -= 1
    }

    /**
     * @param {number=} arg
     * @param {boolean=} noSetTiming
     */ var setMainLoop = (browserIterationFunc, fps, simulateInfiniteLoop, arg, noSetTiming) => {
      Browser.mainLoop.func = browserIterationFunc
      Browser.mainLoop.arg = arg
      // Closure compiler bug(?): Closure does not see that the assignment
      //   var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop
      // is a value copy of a number (even with the JSDoc @type annotation)
      // but optimizeis the code as if the assignment was a reference assignment,
      // which results in Browser.mainLoop.pause() not working. Hence use a
      // workaround to make Closure believe this is a value copy that should occur:
      // (TODO: Minimize this down to a small test case and report - was unable
      // to reproduce in a small written test case)
      /** @type{number} */ var thisMainLoopId = (() => Browser.mainLoop.currentlyRunningMainloop)()
      function checkIsRunning() {
        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) {
          runtimeKeepalivePop()
          maybeExit()
          return false
        }
        return true
      }
      // We create the loop runner here but it is not actually running until
      // _emscripten_set_main_loop_timing is called (which might happen a
      // later time).  This member signifies that the current runner has not
      // yet been started so that we can call runtimeKeepalivePush when it
      // gets it timing set for the first time.
      Browser.mainLoop.running = false
      Browser.mainLoop.runner = function Browser_mainLoop_runner() {
        if (ABORT) return
        if (Browser.mainLoop.queue.length > 0) {
          var start = Date.now()
          var blocker = Browser.mainLoop.queue.shift()
          blocker.func(blocker.arg)
          if (Browser.mainLoop.remainingBlockers) {
            var remaining = Browser.mainLoop.remainingBlockers
            var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining)
            if (blocker.counted) {
              Browser.mainLoop.remainingBlockers = next
            } else {
              // not counted, but move the progress along a tiny bit
              next = next + 0.5
              // do not steal all the next one's progress
              Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
            }
          }
          Browser.mainLoop.updateStatus()
          // catches pause/resume main loop from blocker execution
          if (!checkIsRunning()) return
          setTimeout(Browser.mainLoop.runner, 0)
          return
        }
        // catch pauses from non-main loop sources
        if (!checkIsRunning()) return
        // Implement very basic swap interval control
        Browser.mainLoop.currentFrameNumber = (Browser.mainLoop.currentFrameNumber + 1) | 0
        if (
          Browser.mainLoop.timingMode == 1 &&
          Browser.mainLoop.timingValue > 1 &&
          Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0
        ) {
          // Not the scheduled time to render this frame - skip.
          Browser.mainLoop.scheduler()
          return
        } else if (Browser.mainLoop.timingMode == 0) {
          Browser.mainLoop.tickStartTime = _emscripten_get_now()
        }
        // Signal GL rendering layer that processing of a new frame is about to start. This helps it optimize
        // VBO double-buffering and reduce GPU stalls.
        Browser.mainLoop.runIter(browserIterationFunc)
        // catch pauses from the main loop itself
        if (!checkIsRunning()) return
        // Queue new audio data. This is important to be right after the main loop invocation, so that we will immediately be able
        // to queue the newest produced audio samples.
        // TODO: Consider adding pre- and post- rAF callbacks so that GL.newRenderingFrameStarted() and SDL.audio.queueNewAudioData()
        //       do not need to be hardcoded into this function, but can be more generic.
        if (typeof SDL == 'object') SDL.audio?.queueNewAudioData?.()
        Browser.mainLoop.scheduler()
      }
      if (!noSetTiming) {
        if (fps && fps > 0) {
          _emscripten_set_main_loop_timing(0, 1e3 / fps)
        } else {
          // Do rAF by rendering each frame (no decimating)
          _emscripten_set_main_loop_timing(1, 1)
        }
        Browser.mainLoop.scheduler()
      }
      if (simulateInfiniteLoop) {
        throw 'unwind'
      }
    }

    /** @param {number=} timeout */ var safeSetTimeout = (func, timeout) => {
      runtimeKeepalivePush()
      return setTimeout(() => {
        runtimeKeepalivePop()
        callUserCallback(func)
      }, timeout)
    }

    var Browser = {
      mainLoop: {
        running: false,
        scheduler: null,
        method: '',
        currentlyRunningMainloop: 0,
        func: null,
        arg: 0,
        timingMode: 0,
        timingValue: 0,
        currentFrameNumber: 0,
        queue: [],
        pause() {
          Browser.mainLoop.scheduler = null
          // Incrementing this signals the previous main loop that it's now become old, and it must return.
          Browser.mainLoop.currentlyRunningMainloop++
        },
        resume() {
          Browser.mainLoop.currentlyRunningMainloop++
          var timingMode = Browser.mainLoop.timingMode
          var timingValue = Browser.mainLoop.timingValue
          var func = Browser.mainLoop.func
          Browser.mainLoop.func = null
          // do not set timing and call scheduler, we will do it on the next lines
          setMainLoop(func, 0, false, Browser.mainLoop.arg, true)
          _emscripten_set_main_loop_timing(timingMode, timingValue)
          Browser.mainLoop.scheduler()
        },
        updateStatus() {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...'
            var remaining = Browser.mainLoop.remainingBlockers
            var expected = Browser.mainLoop.expectedBlockers
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](`{message} ({expected - remaining}/{expected})`)
              } else {
                Module['setStatus'](message)
              }
            } else {
              Module['setStatus']('')
            }
          }
        },
        runIter(func) {
          if (ABORT) return
          if (Module['preMainLoop']) {
            var preRet = Module['preMainLoop']()
            if (preRet === false) {
              return
            }
          }
          callUserCallback(func)
          Module['postMainLoop']?.()
        },
      },
      isFullscreen: false,
      pointerLock: false,
      moduleContextCreatedCallbacks: [],
      workers: [],
      init() {
        if (Browser.initted) return
        Browser.initted = true
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to preloadPlugins.
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
        var imagePlugin = {}
        imagePlugin['canHandle'] = function imagePlugin_canHandle(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
        }
        imagePlugin['handle'] = function imagePlugin_handle(byteArray, name, onload, onerror) {
          var b = new Blob([byteArray], {
            type: Browser.getMimetype(name),
          })
          if (b.size !== byteArray.length) {
            // Safari bug #118630
            // Safari's Blob can only take an ArrayBuffer
            b = new Blob([new Uint8Array(byteArray).buffer], {
              type: Browser.getMimetype(name),
            })
          }
          var url = URL.createObjectURL(b)
          var img = new Image()
          img.onload = () => {
            var canvas = /** @type {!HTMLCanvasElement} */ (document.createElement('canvas'))
            canvas.width = img.width
            canvas.height = img.height
            var ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0)
            preloadedImages[name] = canvas
            URL.revokeObjectURL(url)
            onload?.(byteArray)
          }
          img.onerror = (event) => {
            err(`Image ${url} could not be decoded`)
            onerror?.()
          }
          img.src = url
        }
        preloadPlugins.push(imagePlugin)
        var audioPlugin = {}
        audioPlugin['canHandle'] = function audioPlugin_canHandle(name) {
          return (
            !Module.noAudioDecoding &&
            name.substr(-4) in
              {
                '.ogg': 1,
                '.wav': 1,
                '.mp3': 1,
              }
          )
        }
        audioPlugin['handle'] = function audioPlugin_handle(byteArray, name, onload, onerror) {
          var done = false
          function finish(audio) {
            if (done) return
            done = true
            preloadedAudios[name] = audio
            onload?.(byteArray)
          }
          var b = new Blob([byteArray], {
            type: Browser.getMimetype(name),
          })
          var url = URL.createObjectURL(b)
          // XXX we never revoke this!
          var audio = new Audio()
          audio.addEventListener('canplaythrough', () => finish(audio), false)
          // use addEventListener due to chromium bug 124926
          audio.onerror = function audio_onerror(event) {
            if (done) return
            err(
              `warning: browser could not fully decode audio ${name}, trying slower base64 approach`
            )
            function encode64(data) {
              var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
              var PAD = '='
              var ret = ''
              var leftchar = 0
              var leftbits = 0
              for (var i = 0; i < data.length; i++) {
                leftchar = (leftchar << 8) | data[i]
                leftbits += 8
                while (leftbits >= 6) {
                  var curr = (leftchar >> (leftbits - 6)) & 63
                  leftbits -= 6
                  ret += BASE[curr]
                }
              }
              if (leftbits == 2) {
                ret += BASE[(leftchar & 3) << 4]
                ret += PAD + PAD
              } else if (leftbits == 4) {
                ret += BASE[(leftchar & 15) << 2]
                ret += PAD
              }
              return ret
            }
            audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray)
            finish(audio)
          }
          // we don't wait for confirmation this worked - but it's worth trying
          audio.src = url
          // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
          safeSetTimeout(
            () => {
              finish(audio)
            }, // try to use it even though it is not necessarily ready to play
            1e4
          )
        }
        preloadPlugins.push(audioPlugin)
        // Canvas event setup
        function pointerLockChange() {
          Browser.pointerLock =
            document['pointerLockElement'] === Module['canvas'] ||
            document['mozPointerLockElement'] === Module['canvas'] ||
            document['webkitPointerLockElement'] === Module['canvas'] ||
            document['msPointerLockElement'] === Module['canvas']
        }
        var canvas = Module['canvas']
        if (canvas) {
          // forced aspect ratio can be enabled by defining 'forcedAspectRatio' on Module
          // Module['forcedAspectRatio'] = 4 / 3;
          canvas.requestPointerLock =
            canvas['requestPointerLock'] ||
            canvas['mozRequestPointerLock'] ||
            canvas['webkitRequestPointerLock'] ||
            canvas['msRequestPointerLock'] ||
            (() => {})
          canvas.exitPointerLock =
            document['exitPointerLock'] ||
            document['mozExitPointerLock'] ||
            document['webkitExitPointerLock'] ||
            document['msExitPointerLock'] ||
            (() => {})
          // no-op if function does not exist
          canvas.exitPointerLock = canvas.exitPointerLock.bind(document)
          document.addEventListener('pointerlockchange', pointerLockChange, false)
          document.addEventListener('mozpointerlockchange', pointerLockChange, false)
          document.addEventListener('webkitpointerlockchange', pointerLockChange, false)
          document.addEventListener('mspointerlockchange', pointerLockChange, false)
          if (Module['elementPointerLock']) {
            canvas.addEventListener(
              'click',
              (ev) => {
                if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
                  Module['canvas'].requestPointerLock()
                  ev.preventDefault()
                }
              },
              false
            )
          }
        }
      },
      createContext(
        /** @type {HTMLCanvasElement} */ canvas,
        useWebGL,
        setInModule,
        webGLContextAttributes
      ) {
        if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx
        // no need to recreate GL context if it's already been created for this canvas.
        var ctx
        var contextHandle
        if (useWebGL) {
          // For GLES2/desktop GL compatibility, adjust a few defaults to be different to WebGL defaults, so that they align better with the desktop defaults.
          var contextAttributes = {
            antialias: false,
            alpha: false,
            majorVersion: 1,
          }
          if (webGLContextAttributes) {
            for (var attribute in webGLContextAttributes) {
              contextAttributes[attribute] = webGLContextAttributes[attribute]
            }
          }
          // This check of existence of GL is here to satisfy Closure compiler, which yells if variable GL is referenced below but GL object is not
          // actually compiled in because application is not doing any GL operations. TODO: Ideally if GL is not being used, this function
          // Browser.createContext() should not even be emitted.
          if (typeof GL != 'undefined') {
            contextHandle = GL.createContext(canvas, contextAttributes)
            if (contextHandle) {
              ctx = GL.getContext(contextHandle).GLctx
            }
          }
        } else {
          ctx = canvas.getContext('2d')
        }
        if (!ctx) return null
        if (setInModule) {
          Module.ctx = ctx
          if (useWebGL) GL.makeContextCurrent(contextHandle)
          Module.useWebGL = useWebGL
          Browser.moduleContextCreatedCallbacks.forEach((callback) => callback())
          Browser.init()
        }
        return ctx
      },
      destroyContext(canvas, useWebGL, setInModule) {},
      fullscreenHandlersInstalled: false,
      lockPointer: undefined,
      resizeCanvas: undefined,
      requestFullscreen(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer
        Browser.resizeCanvas = resizeCanvas
        if (typeof Browser.lockPointer == 'undefined') Browser.lockPointer = true
        if (typeof Browser.resizeCanvas == 'undefined') Browser.resizeCanvas = false
        var canvas = Module['canvas']
        function fullscreenChange() {
          Browser.isFullscreen = false
          var canvasContainer = canvas.parentNode
          if (
            (document['fullscreenElement'] ||
              document['mozFullScreenElement'] ||
              document['msFullscreenElement'] ||
              document['webkitFullscreenElement'] ||
              document['webkitCurrentFullScreenElement']) === canvasContainer
          ) {
            canvas.exitFullscreen = Browser.exitFullscreen
            if (Browser.lockPointer) canvas.requestPointerLock()
            Browser.isFullscreen = true
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize()
            } else {
              Browser.updateCanvasDimensions(canvas)
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer)
            canvasContainer.parentNode.removeChild(canvasContainer)
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize()
            } else {
              Browser.updateCanvasDimensions(canvas)
            }
          }
          Module['onFullScreen']?.(Browser.isFullscreen)
          Module['onFullscreen']?.(Browser.isFullscreen)
        }
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true
          document.addEventListener('fullscreenchange', fullscreenChange, false)
          document.addEventListener('mozfullscreenchange', fullscreenChange, false)
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false)
          document.addEventListener('MSFullscreenChange', fullscreenChange, false)
        }
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement('div')
        canvas.parentNode.insertBefore(canvasContainer, canvas)
        canvasContainer.appendChild(canvas)
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen =
          canvasContainer['requestFullscreen'] ||
          canvasContainer['mozRequestFullScreen'] ||
          canvasContainer['msRequestFullscreen'] ||
          (canvasContainer['webkitRequestFullscreen']
            ? () => canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT'])
            : null) ||
          (canvasContainer['webkitRequestFullScreen']
            ? () => canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT'])
            : null)
        canvasContainer.requestFullscreen()
      },
      exitFullscreen() {
        // This is workaround for chrome. Trying to exit from fullscreen
        // not in fullscreen state will cause "TypeError: Document not active"
        // in chrome. See https://github.com/emscripten-core/emscripten/pull/8236
        if (!Browser.isFullscreen) {
          return false
        }
        var CFS =
          document['exitFullscreen'] ||
          document['cancelFullScreen'] ||
          document['mozCancelFullScreen'] ||
          document['msExitFullscreen'] ||
          document['webkitCancelFullScreen'] ||
          (() => {})
        CFS.apply(document, [])
        return true
      },
      nextRAF: 0,
      fakeRequestAnimationFrame(func) {
        // try to keep 60fps between calls to here
        var now = Date.now()
        if (Browser.nextRAF === 0) {
          Browser.nextRAF = now + 1e3 / 60
        } else {
          while (now + 2 >= Browser.nextRAF) {
            // fudge a little, to avoid timer jitter causing us to do lots of delay:0
            Browser.nextRAF += 1e3 / 60
          }
        }
        var delay = Math.max(Browser.nextRAF - now, 0)
        setTimeout(func, delay)
      },
      requestAnimationFrame(func) {
        if (typeof requestAnimationFrame == 'function') {
          requestAnimationFrame(func)
          return
        }
        var RAF = Browser.fakeRequestAnimationFrame
        RAF(func)
      },
      safeSetTimeout(func, timeout) {
        // Legacy function, this is used by the SDL2 port so we need to keep it
        // around at least until that is updated.
        // See https://github.com/libsdl-org/SDL/pull/6304
        return safeSetTimeout(func, timeout)
      },
      safeRequestAnimationFrame(func) {
        runtimeKeepalivePush()
        return Browser.requestAnimationFrame(() => {
          runtimeKeepalivePop()
          callUserCallback(func)
        })
      },
      getMimetype(name) {
        return {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          bmp: 'image/bmp',
          ogg: 'audio/ogg',
          wav: 'audio/wav',
          mp3: 'audio/mpeg',
        }[name.substr(name.lastIndexOf('.') + 1)]
      },
      getUserMedia(func) {
        window.getUserMedia ||= navigator['getUserMedia'] || navigator['mozGetUserMedia']
        window.getUserMedia(func)
      },
      getMovementX(event) {
        return event['movementX'] || event['mozMovementX'] || event['webkitMovementX'] || 0
      },
      getMovementY(event) {
        return event['movementY'] || event['mozMovementY'] || event['webkitMovementY'] || 0
      },
      getMouseWheelDelta(event) {
        var delta = 0
        switch (event.type) {
          case 'DOMMouseScroll':
            // 3 lines make up a step
            delta = event.detail / 3
            break

          case 'mousewheel':
            // 120 units make up a step
            delta = event.wheelDelta / 120
            break

          case 'wheel':
            delta = event.deltaY
            switch (event.deltaMode) {
              case 0:
                // DOM_DELTA_PIXEL: 100 pixels make up a step
                delta /= 100
                break

              case 1:
                // DOM_DELTA_LINE: 3 lines make up a step
                delta /= 3
                break

              case 2:
                // DOM_DELTA_PAGE: A page makes up 80 steps
                delta *= 80
                break

              default:
                throw 'unrecognized mouse wheel delta mode: ' + event.deltaMode
            }
            break

          default:
            throw 'unrecognized mouse wheel event: ' + event.type
        }
        return delta
      },
      mouseX: 0,
      mouseY: 0,
      mouseMovementX: 0,
      mouseMovementY: 0,
      touches: {},
      lastTouches: {},
      calculateMouseCoords(pageX, pageY) {
        // Calculate the movement based on the changes
        // in the coordinates.
        var rect = Module['canvas'].getBoundingClientRect()
        var cw = Module['canvas'].width
        var ch = Module['canvas'].height
        // Neither .scrollX or .pageXOffset are defined in a spec, but
        // we prefer .scrollX because it is currently in a spec draft.
        // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
        var scrollX = typeof window.scrollX != 'undefined' ? window.scrollX : window.pageXOffset
        var scrollY = typeof window.scrollY != 'undefined' ? window.scrollY : window.pageYOffset
        var adjustedX = pageX - (scrollX + rect.left)
        var adjustedY = pageY - (scrollY + rect.top)
        // the canvas might be CSS-scaled compared to its backbuffer;
        // SDL-using content will want mouse coordinates in terms
        // of backbuffer units.
        adjustedX = adjustedX * (cw / rect.width)
        adjustedY = adjustedY * (ch / rect.height)
        return {
          x: adjustedX,
          y: adjustedY,
        }
      },
      setMouseCoords(pageX, pageY) {
        const { x: x, y: y } = Browser.calculateMouseCoords(pageX, pageY)
        Browser.mouseMovementX = x - Browser.mouseX
        Browser.mouseMovementY = y - Browser.mouseY
        Browser.mouseX = x
        Browser.mouseY = y
      },
      calculateMouseEvent(event) {
        // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' && 'mozMovementX' in event) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event)
            Browser.mouseMovementY = Browser.getMovementY(event)
          }
          // add the mouse delta to the current absolute mouse position
          Browser.mouseX += Browser.mouseMovementX
          Browser.mouseY += Browser.mouseMovementY
        } else {
          if (
            event.type === 'touchstart' ||
            event.type === 'touchend' ||
            event.type === 'touchmove'
          ) {
            var touch = event.touch
            if (touch === undefined) {
              return
            }
            // the "touch" property is only defined in SDL
            var coords = Browser.calculateMouseCoords(touch.pageX, touch.pageY)
            if (event.type === 'touchstart') {
              Browser.lastTouches[touch.identifier] = coords
              Browser.touches[touch.identifier] = coords
            } else if (event.type === 'touchend' || event.type === 'touchmove') {
              var last = Browser.touches[touch.identifier]
              last ||= coords
              Browser.lastTouches[touch.identifier] = last
              Browser.touches[touch.identifier] = coords
            }
            return
          }
          Browser.setMouseCoords(event.pageX, event.pageY)
        }
      },
      resizeListeners: [],
      updateResizeListeners() {
        var canvas = Module['canvas']
        Browser.resizeListeners.forEach((listener) => listener(canvas.width, canvas.height))
      },
      setCanvasSize(width, height, noUpdates) {
        var canvas = Module['canvas']
        Browser.updateCanvasDimensions(canvas, width, height)
        if (!noUpdates) Browser.updateResizeListeners()
      },
      windowedWidth: 0,
      windowedHeight: 0,
      setFullscreenCanvasSize() {
        // check if SDL is available
        if (typeof SDL != 'undefined') {
          var flags = GROWABLE_HEAP_U32()[SDL.screen >> 2]
          flags = flags | 8388608
          // set SDL_FULLSCREEN flag
          GROWABLE_HEAP_I32()[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module['canvas'])
        Browser.updateResizeListeners()
      },
      setWindowedCanvasSize() {
        // check if SDL is available
        if (typeof SDL != 'undefined') {
          var flags = GROWABLE_HEAP_U32()[SDL.screen >> 2]
          flags = flags & ~8388608
          // clear SDL_FULLSCREEN flag
          GROWABLE_HEAP_I32()[SDL.screen >> 2] = flags
        }
        Browser.updateCanvasDimensions(Module['canvas'])
        Browser.updateResizeListeners()
      },
      updateCanvasDimensions(canvas, wNative, hNative) {
        if (wNative && hNative) {
          canvas.widthNative = wNative
          canvas.heightNative = hNative
        } else {
          wNative = canvas.widthNative
          hNative = canvas.heightNative
        }
        var w = wNative
        var h = hNative
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w / h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio'])
          } else {
            h = Math.round(w / Module['forcedAspectRatio'])
          }
        }
        if (
          (document['fullscreenElement'] ||
            document['mozFullScreenElement'] ||
            document['msFullscreenElement'] ||
            document['webkitFullscreenElement'] ||
            document['webkitCurrentFullScreenElement']) === canvas.parentNode &&
          typeof screen != 'undefined'
        ) {
          var factor = Math.min(screen.width / w, screen.height / h)
          w = Math.round(w * factor)
          h = Math.round(h * factor)
        }
        if (Browser.resizeCanvas) {
          if (canvas.width != w) canvas.width = w
          if (canvas.height != h) canvas.height = h
          if (typeof canvas.style != 'undefined') {
            canvas.style.removeProperty('width')
            canvas.style.removeProperty('height')
          }
        } else {
          if (canvas.width != wNative) canvas.width = wNative
          if (canvas.height != hNative) canvas.height = hNative
          if (typeof canvas.style != 'undefined') {
            if (w != wNative || h != hNative) {
              canvas.style.setProperty('width', w + 'px', 'important')
              canvas.style.setProperty('height', h + 'px', 'important')
            } else {
              canvas.style.removeProperty('width')
              canvas.style.removeProperty('height')
            }
          }
        }
      },
    }

    function _emscripten_set_window_title(title) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(26, 0, 1, title)
      return (document.title = UTF8ToString(title))
    }

    var _emscripten_sleep = (ms) => Asyncify.handleSleep((wakeUp) => safeSetTimeout(wakeUp, ms))

    _emscripten_sleep.isAsync = true

    function _fd_close(fd) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(27, 0, 1, fd)
      try {
        var stream = SYSCALLS.getStreamFromFD(fd)
        FS.close(stream)
        return 0
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return e.errno
      }
    }

    /** @param {number=} offset */ var doReadv = (stream, iov, iovcnt, offset) => {
      var ret = 0
      for (var i = 0; i < iovcnt; i++) {
        var ptr = GROWABLE_HEAP_U32()[iov >> 2]
        var len = GROWABLE_HEAP_U32()[(iov + 4) >> 2]
        iov += 8
        var curr = FS.read(stream, GROWABLE_HEAP_I8(), ptr, len, offset)
        if (curr < 0) return -1
        ret += curr
        if (curr < len) break
        // nothing more to read
        if (typeof offset != 'undefined') {
          offset += curr
        }
      }
      return ret
    }

    function _fd_read(fd, iov, iovcnt, pnum) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(28, 0, 1, fd, iov, iovcnt, pnum)
      try {
        var stream = SYSCALLS.getStreamFromFD(fd)
        var num = doReadv(stream, iov, iovcnt)
        GROWABLE_HEAP_U32()[pnum >> 2] = num
        return 0
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return e.errno
      }
    }

    function _fd_seek(fd, offset_low, offset_high, whence, newOffset) {
      if (ENVIRONMENT_IS_PTHREAD)
        return proxyToMainThread(29, 0, 1, fd, offset_low, offset_high, whence, newOffset)
      var offset = convertI32PairToI53Checked(offset_low, offset_high)
      try {
        if (isNaN(offset)) return 61
        var stream = SYSCALLS.getStreamFromFD(fd)
        FS.llseek(stream, offset, whence)
        ;(tempI64 = [
          stream.position >>> 0,
          ((tempDouble = stream.position),
          +Math.abs(tempDouble) >= 1
            ? tempDouble > 0
              ? +Math.floor(tempDouble / 4294967296) >>> 0
              : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0
            : 0),
        ]),
          (GROWABLE_HEAP_I32()[newOffset >> 2] = tempI64[0]),
          (GROWABLE_HEAP_I32()[(newOffset + 4) >> 2] = tempI64[1])
        if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null
        // reset readdir state
        return 0
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return e.errno
      }
    }

    /** @param {number=} offset */ var doWritev = (stream, iov, iovcnt, offset) => {
      var ret = 0
      for (var i = 0; i < iovcnt; i++) {
        var ptr = GROWABLE_HEAP_U32()[iov >> 2]
        var len = GROWABLE_HEAP_U32()[(iov + 4) >> 2]
        iov += 8
        var curr = FS.write(stream, GROWABLE_HEAP_I8(), ptr, len, offset)
        if (curr < 0) return -1
        ret += curr
        if (typeof offset != 'undefined') {
          offset += curr
        }
      }
      return ret
    }

    function _fd_write(fd, iov, iovcnt, pnum) {
      if (ENVIRONMENT_IS_PTHREAD) return proxyToMainThread(30, 0, 1, fd, iov, iovcnt, pnum)
      try {
        var stream = SYSCALLS.getStreamFromFD(fd)
        var num = doWritev(stream, iov, iovcnt)
        GROWABLE_HEAP_U32()[pnum >> 2] = num
        return 0
      } catch (e) {
        if (typeof FS == 'undefined' || !(e.name === 'ErrnoError')) throw e
        return e.errno
      }
    }

    var _getentropy = (buffer, size) => {
      randomFill(GROWABLE_HEAP_U8().subarray(buffer, buffer + size))
      return 0
    }

    /** @constructor */ function GLFW_Window(
      id,
      width,
      height,
      framebufferWidth,
      framebufferHeight,
      title,
      monitor,
      share
    ) {
      this.id = id
      this.x = 0
      this.y = 0
      this.fullscreen = false
      // Used to determine if app in fullscreen mode
      this.storedX = 0
      // Used to store X before fullscreen
      this.storedY = 0
      // Used to store Y before fullscreen
      this.width = width
      this.height = height
      this.framebufferWidth = framebufferWidth
      this.framebufferHeight = framebufferHeight
      this.storedWidth = width
      // Used to store width before fullscreen
      this.storedHeight = height
      // Used to store height before fullscreen
      this.title = title
      this.monitor = monitor
      this.share = share
      this.attributes = Object.assign({}, GLFW.hints)
      this.inputModes = {
        208897: 212993,
        // GLFW_CURSOR (GLFW_CURSOR_NORMAL)
        208898: 0,
        // GLFW_STICKY_KEYS
        208899: 0,
      }
      // GLFW_STICKY_MOUSE_BUTTONS
      this.buttons = 0
      this.keys = new Array()
      this.domKeys = new Array()
      this.shouldClose = 0
      this.title = null
      this.windowPosFunc = 0
      // GLFWwindowposfun
      this.windowSizeFunc = 0
      // GLFWwindowsizefun
      this.windowCloseFunc = 0
      // GLFWwindowclosefun
      this.windowRefreshFunc = 0
      // GLFWwindowrefreshfun
      this.windowFocusFunc = 0
      // GLFWwindowfocusfun
      this.windowIconifyFunc = 0
      // GLFWwindowiconifyfun
      this.windowMaximizeFunc = 0
      // GLFWwindowmaximizefun
      this.framebufferSizeFunc = 0
      // GLFWframebuffersizefun
      this.windowContentScaleFunc = 0
      // GLFWwindowcontentscalefun
      this.mouseButtonFunc = 0
      // GLFWmousebuttonfun
      this.cursorPosFunc = 0
      // GLFWcursorposfun
      this.cursorEnterFunc = 0
      // GLFWcursorenterfun
      this.scrollFunc = 0
      // GLFWscrollfun
      this.dropFunc = 0
      // GLFWdropfun
      this.keyFunc = 0
      // GLFWkeyfun
      this.charFunc = 0
      // GLFWcharfun
      this.userptr = 0
    }

    var GLFW = {
      WindowFromId: (id) => {
        if (id <= 0 || !GLFW.windows) return null
        return GLFW.windows[id - 1]
      },
      joystickFunc: 0,
      errorFunc: 0,
      monitorFunc: 0,
      active: null,
      scale: null,
      windows: null,
      monitors: null,
      monitorString: null,
      versionString: null,
      initialTime: null,
      extensions: null,
      devicePixelRatioMQL: null,
      hints: null,
      primaryTouchId: null,
      defaultHints: {
        131073: 0,
        131074: 0,
        131075: 1,
        131076: 1,
        131077: 1,
        131082: 0,
        135169: 8,
        135170: 8,
        135171: 8,
        135172: 8,
        135173: 24,
        135174: 8,
        135175: 0,
        135176: 0,
        135177: 0,
        135178: 0,
        135179: 0,
        135180: 0,
        135181: 0,
        135182: 0,
        135183: 0,
        139265: 196609,
        139266: 1,
        139267: 0,
        139268: 0,
        139269: 0,
        139270: 0,
        139271: 0,
        139272: 0,
        139276: 0,
      },
      DOMToGLFWKeyCode: (keycode) => {
        switch (keycode) {
          // these keycodes are only defined for GLFW3, assume they are the same for GLFW2
          case 32:
            return 32

          // DOM_VK_SPACE -> GLFW_KEY_SPACE
          case 222:
            return 39

          // DOM_VK_QUOTE -> GLFW_KEY_APOSTROPHE
          case 188:
            return 44

          // DOM_VK_COMMA -> GLFW_KEY_COMMA
          case 173:
            return 45

          // DOM_VK_HYPHEN_MINUS -> GLFW_KEY_MINUS
          case 189:
            return 45

          // DOM_VK_MINUS -> GLFW_KEY_MINUS
          case 190:
            return 46

          // DOM_VK_PERIOD -> GLFW_KEY_PERIOD
          case 191:
            return 47

          // DOM_VK_SLASH -> GLFW_KEY_SLASH
          case 48:
            return 48

          // DOM_VK_0 -> GLFW_KEY_0
          case 49:
            return 49

          // DOM_VK_1 -> GLFW_KEY_1
          case 50:
            return 50

          // DOM_VK_2 -> GLFW_KEY_2
          case 51:
            return 51

          // DOM_VK_3 -> GLFW_KEY_3
          case 52:
            return 52

          // DOM_VK_4 -> GLFW_KEY_4
          case 53:
            return 53

          // DOM_VK_5 -> GLFW_KEY_5
          case 54:
            return 54

          // DOM_VK_6 -> GLFW_KEY_6
          case 55:
            return 55

          // DOM_VK_7 -> GLFW_KEY_7
          case 56:
            return 56

          // DOM_VK_8 -> GLFW_KEY_8
          case 57:
            return 57

          // DOM_VK_9 -> GLFW_KEY_9
          case 59:
            return 59

          // DOM_VK_SEMICOLON -> GLFW_KEY_SEMICOLON
          case 61:
            return 61

          // DOM_VK_EQUALS -> GLFW_KEY_EQUAL
          case 187:
            return 61

          // DOM_VK_EQUALS -> GLFW_KEY_EQUAL
          case 65:
            return 65

          // DOM_VK_A -> GLFW_KEY_A
          case 66:
            return 66

          // DOM_VK_B -> GLFW_KEY_B
          case 67:
            return 67

          // DOM_VK_C -> GLFW_KEY_C
          case 68:
            return 68

          // DOM_VK_D -> GLFW_KEY_D
          case 69:
            return 69

          // DOM_VK_E -> GLFW_KEY_E
          case 70:
            return 70

          // DOM_VK_F -> GLFW_KEY_F
          case 71:
            return 71

          // DOM_VK_G -> GLFW_KEY_G
          case 72:
            return 72

          // DOM_VK_H -> GLFW_KEY_H
          case 73:
            return 73

          // DOM_VK_I -> GLFW_KEY_I
          case 74:
            return 74

          // DOM_VK_J -> GLFW_KEY_J
          case 75:
            return 75

          // DOM_VK_K -> GLFW_KEY_K
          case 76:
            return 76

          // DOM_VK_L -> GLFW_KEY_L
          case 77:
            return 77

          // DOM_VK_M -> GLFW_KEY_M
          case 78:
            return 78

          // DOM_VK_N -> GLFW_KEY_N
          case 79:
            return 79

          // DOM_VK_O -> GLFW_KEY_O
          case 80:
            return 80

          // DOM_VK_P -> GLFW_KEY_P
          case 81:
            return 81

          // DOM_VK_Q -> GLFW_KEY_Q
          case 82:
            return 82

          // DOM_VK_R -> GLFW_KEY_R
          case 83:
            return 83

          // DOM_VK_S -> GLFW_KEY_S
          case 84:
            return 84

          // DOM_VK_T -> GLFW_KEY_T
          case 85:
            return 85

          // DOM_VK_U -> GLFW_KEY_U
          case 86:
            return 86

          // DOM_VK_V -> GLFW_KEY_V
          case 87:
            return 87

          // DOM_VK_W -> GLFW_KEY_W
          case 88:
            return 88

          // DOM_VK_X -> GLFW_KEY_X
          case 89:
            return 89

          // DOM_VK_Y -> GLFW_KEY_Y
          case 90:
            return 90

          // DOM_VK_Z -> GLFW_KEY_Z
          case 219:
            return 91

          // DOM_VK_OPEN_BRACKET -> GLFW_KEY_LEFT_BRACKET
          case 220:
            return 92

          // DOM_VK_BACKSLASH -> GLFW_KEY_BACKSLASH
          case 221:
            return 93

          // DOM_VK_CLOSE_BRACKET -> GLFW_KEY_RIGHT_BRACKET
          case 192:
            return 96

          // DOM_VK_BACK_QUOTE -> GLFW_KEY_GRAVE_ACCENT
          case 27:
            return 256

          // DOM_VK_ESCAPE -> GLFW_KEY_ESCAPE
          case 13:
            return 257

          // DOM_VK_RETURN -> GLFW_KEY_ENTER
          case 9:
            return 258

          // DOM_VK_TAB -> GLFW_KEY_TAB
          case 8:
            return 259

          // DOM_VK_BACK -> GLFW_KEY_BACKSPACE
          case 45:
            return 260

          // DOM_VK_INSERT -> GLFW_KEY_INSERT
          case 46:
            return 261

          // DOM_VK_DELETE -> GLFW_KEY_DELETE
          case 39:
            return 262

          // DOM_VK_RIGHT -> GLFW_KEY_RIGHT
          case 37:
            return 263

          // DOM_VK_LEFT -> GLFW_KEY_LEFT
          case 40:
            return 264

          // DOM_VK_DOWN -> GLFW_KEY_DOWN
          case 38:
            return 265

          // DOM_VK_UP -> GLFW_KEY_UP
          case 33:
            return 266

          // DOM_VK_PAGE_UP -> GLFW_KEY_PAGE_UP
          case 34:
            return 267

          // DOM_VK_PAGE_DOWN -> GLFW_KEY_PAGE_DOWN
          case 36:
            return 268

          // DOM_VK_HOME -> GLFW_KEY_HOME
          case 35:
            return 269

          // DOM_VK_END -> GLFW_KEY_END
          case 20:
            return 280

          // DOM_VK_CAPS_LOCK -> GLFW_KEY_CAPS_LOCK
          case 145:
            return 281

          // DOM_VK_SCROLL_LOCK -> GLFW_KEY_SCROLL_LOCK
          case 144:
            return 282

          // DOM_VK_NUM_LOCK -> GLFW_KEY_NUM_LOCK
          case 44:
            return 283

          // DOM_VK_SNAPSHOT -> GLFW_KEY_PRINT_SCREEN
          case 19:
            return 284

          // DOM_VK_PAUSE -> GLFW_KEY_PAUSE
          case 112:
            return 290

          // DOM_VK_F1 -> GLFW_KEY_F1
          case 113:
            return 291

          // DOM_VK_F2 -> GLFW_KEY_F2
          case 114:
            return 292

          // DOM_VK_F3 -> GLFW_KEY_F3
          case 115:
            return 293

          // DOM_VK_F4 -> GLFW_KEY_F4
          case 116:
            return 294

          // DOM_VK_F5 -> GLFW_KEY_F5
          case 117:
            return 295

          // DOM_VK_F6 -> GLFW_KEY_F6
          case 118:
            return 296

          // DOM_VK_F7 -> GLFW_KEY_F7
          case 119:
            return 297

          // DOM_VK_F8 -> GLFW_KEY_F8
          case 120:
            return 298

          // DOM_VK_F9 -> GLFW_KEY_F9
          case 121:
            return 299

          // DOM_VK_F10 -> GLFW_KEY_F10
          case 122:
            return 300

          // DOM_VK_F11 -> GLFW_KEY_F11
          case 123:
            return 301

          // DOM_VK_F12 -> GLFW_KEY_F12
          case 124:
            return 302

          // DOM_VK_F13 -> GLFW_KEY_F13
          case 125:
            return 303

          // DOM_VK_F14 -> GLFW_KEY_F14
          case 126:
            return 304

          // DOM_VK_F15 -> GLFW_KEY_F15
          case 127:
            return 305

          // DOM_VK_F16 -> GLFW_KEY_F16
          case 128:
            return 306

          // DOM_VK_F17 -> GLFW_KEY_F17
          case 129:
            return 307

          // DOM_VK_F18 -> GLFW_KEY_F18
          case 130:
            return 308

          // DOM_VK_F19 -> GLFW_KEY_F19
          case 131:
            return 309

          // DOM_VK_F20 -> GLFW_KEY_F20
          case 132:
            return 310

          // DOM_VK_F21 -> GLFW_KEY_F21
          case 133:
            return 311

          // DOM_VK_F22 -> GLFW_KEY_F22
          case 134:
            return 312

          // DOM_VK_F23 -> GLFW_KEY_F23
          case 135:
            return 313

          // DOM_VK_F24 -> GLFW_KEY_F24
          case 136:
            return 314

          // 0x88 (not used?) -> GLFW_KEY_F25
          case 96:
            return 320

          // DOM_VK_NUMPAD0 -> GLFW_KEY_KP_0
          case 97:
            return 321

          // DOM_VK_NUMPAD1 -> GLFW_KEY_KP_1
          case 98:
            return 322

          // DOM_VK_NUMPAD2 -> GLFW_KEY_KP_2
          case 99:
            return 323

          // DOM_VK_NUMPAD3 -> GLFW_KEY_KP_3
          case 100:
            return 324

          // DOM_VK_NUMPAD4 -> GLFW_KEY_KP_4
          case 101:
            return 325

          // DOM_VK_NUMPAD5 -> GLFW_KEY_KP_5
          case 102:
            return 326

          // DOM_VK_NUMPAD6 -> GLFW_KEY_KP_6
          case 103:
            return 327

          // DOM_VK_NUMPAD7 -> GLFW_KEY_KP_7
          case 104:
            return 328

          // DOM_VK_NUMPAD8 -> GLFW_KEY_KP_8
          case 105:
            return 329

          // DOM_VK_NUMPAD9 -> GLFW_KEY_KP_9
          case 110:
            return 330

          // DOM_VK_DECIMAL -> GLFW_KEY_KP_DECIMAL
          case 111:
            return 331

          // DOM_VK_DIVIDE -> GLFW_KEY_KP_DIVIDE
          case 106:
            return 332

          // DOM_VK_MULTIPLY -> GLFW_KEY_KP_MULTIPLY
          case 109:
            return 333

          // DOM_VK_SUBTRACT -> GLFW_KEY_KP_SUBTRACT
          case 107:
            return 334

          // DOM_VK_ADD -> GLFW_KEY_KP_ADD
          // case 0x0D:return 335; // DOM_VK_RETURN -> GLFW_KEY_KP_ENTER (DOM_KEY_LOCATION_RIGHT)
          // case 0x61:return 336; // DOM_VK_EQUALS -> GLFW_KEY_KP_EQUAL (DOM_KEY_LOCATION_RIGHT)
          case 16:
            return 340

          // DOM_VK_SHIFT -> GLFW_KEY_LEFT_SHIFT
          case 17:
            return 341

          // DOM_VK_CONTROL -> GLFW_KEY_LEFT_CONTROL
          case 18:
            return 342

          // DOM_VK_ALT -> GLFW_KEY_LEFT_ALT
          case 91:
            return 343

          // DOM_VK_WIN -> GLFW_KEY_LEFT_SUPER
          case 224:
            return 343

          // DOM_VK_META -> GLFW_KEY_LEFT_SUPER
          // case 0x10:return 344; // DOM_VK_SHIFT -> GLFW_KEY_RIGHT_SHIFT (DOM_KEY_LOCATION_RIGHT)
          // case 0x11:return 345; // DOM_VK_CONTROL -> GLFW_KEY_RIGHT_CONTROL (DOM_KEY_LOCATION_RIGHT)
          // case 0x12:return 346; // DOM_VK_ALT -> GLFW_KEY_RIGHT_ALT (DOM_KEY_LOCATION_RIGHT)
          // case 0x5B:return 347; // DOM_VK_WIN -> GLFW_KEY_RIGHT_SUPER (DOM_KEY_LOCATION_RIGHT)
          case 93:
            return 348

          // DOM_VK_CONTEXT_MENU -> GLFW_KEY_MENU
          // XXX: GLFW_KEY_WORLD_1, GLFW_KEY_WORLD_2 what are these?
          default:
            return -1
        }
      },
      getModBits: (win) => {
        var mod = 0
        if (win.keys[340]) mod |= 1
        // GLFW_MOD_SHIFT
        if (win.keys[341]) mod |= 2
        // GLFW_MOD_CONTROL
        if (win.keys[342]) mod |= 4
        // GLFW_MOD_ALT
        if (win.keys[343] || win.keys[348]) mod |= 8
        // GLFW_MOD_SUPER
        // add caps and num lock keys? only if lock_key_mod is set
        return mod
      },
      onKeyPress: (event) => {
        if (!GLFW.active || !GLFW.active.charFunc) return
        if (event.ctrlKey || event.metaKey) return
        // correct unicode charCode is only available with onKeyPress event
        var charCode = event.charCode
        if (charCode == 0 || (charCode >= 0 && charCode <= 31)) return
        ;((a1, a2) => dynCall_vii(GLFW.active.charFunc, a1, a2))(GLFW.active.id, charCode)
      },
      onKeyChanged: (keyCode, status) => {
        if (!GLFW.active) return
        var key = GLFW.DOMToGLFWKeyCode(keyCode)
        if (key == -1) return
        var repeat = status && GLFW.active.keys[key]
        GLFW.active.keys[key] = status
        GLFW.active.domKeys[keyCode] = status
        if (GLFW.active.keyFunc) {
          if (repeat)
            status = 2
            // GLFW_REPEAT
          ;((a1, a2, a3, a4, a5) => dynCall_viiiii(GLFW.active.keyFunc, a1, a2, a3, a4, a5))(
            GLFW.active.id,
            key,
            keyCode,
            status,
            GLFW.getModBits(GLFW.active)
          )
        }
      },
      onGamepadConnected: (event) => {
        GLFW.refreshJoysticks()
      },
      onGamepadDisconnected: (event) => {
        GLFW.refreshJoysticks()
      },
      onKeydown: (event) => {
        GLFW.onKeyChanged(event.keyCode, 1)
        // GLFW_PRESS or GLFW_REPEAT
        // This logic comes directly from the sdl implementation. We cannot
        // call preventDefault on all keydown events otherwise onKeyPress will
        // not get called
        if (event.keyCode === 8 || /* backspace */ event.keyCode === 9) {
          /* tab */ event.preventDefault()
        }
      },
      onKeyup: (event) => {
        GLFW.onKeyChanged(event.keyCode, 0)
      },
      // GLFW_RELEASE
      onBlur: (event) => {
        if (!GLFW.active) return
        for (var i = 0; i < GLFW.active.domKeys.length; ++i) {
          if (GLFW.active.domKeys[i]) {
            GLFW.onKeyChanged(i, 0)
          }
        }
      },
      onMousemove: (event) => {
        if (!GLFW.active) return
        if (event.type === 'touchmove') {
          // Handling for touch events that are being converted to mouse input.
          // Don't let the browser fire a duplicate mouse event.
          event.preventDefault()
          let primaryChanged = false
          for (let i of event.changedTouches) {
            // If our chosen primary touch moved, update Browser mouse coords
            if (GLFW.primaryTouchId === i.identifier) {
              Browser.setMouseCoords(i.pageX, i.pageY)
              primaryChanged = true
              break
            }
          }
          if (!primaryChanged) {
            // Do not send mouse events if some touch other than the primary triggered this.
            return
          }
        } else {
          // Handling for non-touch mouse input events.
          Browser.calculateMouseEvent(event)
        }
        if (event.target != Module['canvas'] || !GLFW.active.cursorPosFunc) return
        if (GLFW.active.cursorPosFunc) {
          ;((a1, a2, a3) => dynCall_vidd(GLFW.active.cursorPosFunc, a1, a2, a3))(
            GLFW.active.id,
            Browser.mouseX,
            Browser.mouseY
          )
        }
      },
      DOMToGLFWMouseButton: (event) => {
        // DOM and glfw have different button codes.
        // See http://www.w3schools.com/jsref/event_button.asp.
        var eventButton = event['button']
        if (eventButton > 0) {
          if (eventButton == 1) {
            eventButton = 2
          } else {
            eventButton = 1
          }
        }
        return eventButton
      },
      onMouseenter: (event) => {
        if (!GLFW.active) return
        if (event.target != Module['canvas']) return
        if (GLFW.active.cursorEnterFunc) {
          ;((a1, a2) => dynCall_vii(GLFW.active.cursorEnterFunc, a1, a2))(GLFW.active.id, 1)
        }
      },
      onMouseleave: (event) => {
        if (!GLFW.active) return
        if (event.target != Module['canvas']) return
        if (GLFW.active.cursorEnterFunc) {
          ;((a1, a2) => dynCall_vii(GLFW.active.cursorEnterFunc, a1, a2))(GLFW.active.id, 0)
        }
      },
      onMouseButtonChanged: (event, status) => {
        if (!GLFW.active) return
        if (event.target != Module['canvas']) return
        // Is this from a touch event?
        const isTouchType =
          event.type === 'touchstart' || event.type === 'touchend' || event.type === 'touchcancel'
        // Only emulating mouse left-click behavior for touches.
        let eventButton = 0
        if (isTouchType) {
          // Handling for touch events that are being converted to mouse input.
          // Don't let the browser fire a duplicate mouse event.
          event.preventDefault()
          let primaryChanged = false
          // Set a primary touch if we have none.
          if (
            GLFW.primaryTouchId === null &&
            event.type === 'touchstart' &&
            event.targetTouches.length > 0
          ) {
            // Pick the first touch that started in the canvas and treat it as primary.
            const chosenTouch = event.targetTouches[0]
            GLFW.primaryTouchId = chosenTouch.identifier
            Browser.setMouseCoords(chosenTouch.pageX, chosenTouch.pageY)
            primaryChanged = true
          } else if (event.type === 'touchend' || event.type === 'touchcancel') {
            // Clear the primary touch if it ended.
            for (let i of event.changedTouches) {
              // If our chosen primary touch ended, remove it.
              if (GLFW.primaryTouchId === i.identifier) {
                GLFW.primaryTouchId = null
                primaryChanged = true
                break
              }
            }
          }
          if (!primaryChanged) {
            // Do not send mouse events if some touch other than the primary triggered this.
            return
          }
        } else {
          // Handling for non-touch mouse input events.
          Browser.calculateMouseEvent(event)
          eventButton = GLFW.DOMToGLFWMouseButton(event)
        }
        if (status == 1) {
          // GLFW_PRESS
          GLFW.active.buttons |= 1 << eventButton
          try {
            event.target.setCapture()
          } catch (e) {}
        } else {
          // GLFW_RELEASE
          GLFW.active.buttons &= ~(1 << eventButton)
        }
        // Send mouse event to GLFW.
        if (GLFW.active.mouseButtonFunc) {
          ;((a1, a2, a3, a4) => dynCall_viiii(GLFW.active.mouseButtonFunc, a1, a2, a3, a4))(
            GLFW.active.id,
            eventButton,
            status,
            GLFW.getModBits(GLFW.active)
          )
        }
      },
      onMouseButtonDown: (event) => {
        if (!GLFW.active) return
        GLFW.onMouseButtonChanged(event, 1)
      },
      // GLFW_PRESS
      onMouseButtonUp: (event) => {
        if (!GLFW.active) return
        GLFW.onMouseButtonChanged(event, 0)
      },
      // GLFW_RELEASE
      onMouseWheel: (event) => {
        // Note the minus sign that flips browser wheel direction (positive direction scrolls page down) to native wheel direction (positive direction is mouse wheel up)
        var delta = -Browser.getMouseWheelDelta(event)
        delta = delta == 0 ? 0 : delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1)
        // Quantize to integer so that minimum scroll is at least +/- 1.
        GLFW.wheelPos += delta
        if (!GLFW.active || !GLFW.active.scrollFunc || event.target != Module['canvas']) return
        var sx = 0
        var sy = delta
        if (event.type == 'mousewheel') {
          sx = event.wheelDeltaX
        } else {
          sx = event.deltaX
        }
        ;((a1, a2, a3) => dynCall_vidd(GLFW.active.scrollFunc, a1, a2, a3))(GLFW.active.id, sx, sy)
        event.preventDefault()
      },
      onCanvasResize: (width, height, framebufferWidth, framebufferHeight) => {
        if (!GLFW.active) return
        var resizeNeeded = false
        // If the client is requesting fullscreen mode
        if (
          document['fullscreen'] ||
          document['fullScreen'] ||
          document['mozFullScreen'] ||
          document['webkitIsFullScreen']
        ) {
          if (!GLFW.active.fullscreen) {
            resizeNeeded = width != screen.width || height != screen.height
            GLFW.active.storedX = GLFW.active.x
            GLFW.active.storedY = GLFW.active.y
            GLFW.active.storedWidth = GLFW.active.width
            GLFW.active.storedHeight = GLFW.active.height
            GLFW.active.x = GLFW.active.y = 0
            GLFW.active.width = screen.width
            GLFW.active.height = screen.height
            GLFW.active.fullscreen = true
          }
        } // If the client is reverting from fullscreen mode
        else if (GLFW.active.fullscreen == true) {
          resizeNeeded = width != GLFW.active.storedWidth || height != GLFW.active.storedHeight
          GLFW.active.x = GLFW.active.storedX
          GLFW.active.y = GLFW.active.storedY
          GLFW.active.width = GLFW.active.storedWidth
          GLFW.active.height = GLFW.active.storedHeight
          GLFW.active.fullscreen = false
        }
        if (resizeNeeded) {
          // width or height is changed (fullscreen / exit fullscreen) which will call this listener back
          // with proper framebufferWidth/framebufferHeight
          Browser.setCanvasSize(GLFW.active.width, GLFW.active.height)
        } else if (
          GLFW.active.width != width ||
          GLFW.active.height != height ||
          GLFW.active.framebufferWidth != framebufferWidth ||
          GLFW.active.framebufferHeight != framebufferHeight
        ) {
          GLFW.active.width = width
          GLFW.active.height = height
          GLFW.active.framebufferWidth = framebufferWidth
          GLFW.active.framebufferHeight = framebufferHeight
          GLFW.onWindowSizeChanged()
          GLFW.onFramebufferSizeChanged()
        }
      },
      onWindowSizeChanged: () => {
        if (!GLFW.active) return
        if (GLFW.active.windowSizeFunc) {
          ;((a1, a2, a3) => dynCall_viii(GLFW.active.windowSizeFunc, a1, a2, a3))(
            GLFW.active.id,
            GLFW.active.width,
            GLFW.active.height
          )
        }
      },
      onFramebufferSizeChanged: () => {
        if (!GLFW.active) return
        if (GLFW.active.framebufferSizeFunc) {
          ;((a1, a2, a3) => dynCall_viii(GLFW.active.framebufferSizeFunc, a1, a2, a3))(
            GLFW.active.id,
            GLFW.active.framebufferWidth,
            GLFW.active.framebufferHeight
          )
        }
      },
      onWindowContentScaleChanged: (scale) => {
        GLFW.scale = scale
        if (!GLFW.active) return
        if (GLFW.active.windowContentScaleFunc) {
          ;((a1, a2, a3) => dynCall_viff(GLFW.active.windowContentScaleFunc, a1, a2, a3))(
            GLFW.active.id,
            GLFW.scale,
            GLFW.scale
          )
        }
      },
      getTime: () => _emscripten_get_now() / 1e3,
      setWindowTitle: (winid, title) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return
        win.title = title
        if (GLFW.active.id == win.id) {
          _emscripten_set_window_title(title)
        }
      },
      setJoystickCallback: (cbfun) => {
        var prevcbfun = GLFW.joystickFunc
        GLFW.joystickFunc = cbfun
        GLFW.refreshJoysticks()
        return prevcbfun
      },
      joys: {},
      lastGamepadState: [],
      lastGamepadStateFrame: null,
      refreshJoysticks: () => {
        // Produce a new Gamepad API sample if we are ticking a new game frame, or if not using emscripten_set_main_loop() at all to drive animation.
        if (
          Browser.mainLoop.currentFrameNumber !== GLFW.lastGamepadStateFrame ||
          !Browser.mainLoop.currentFrameNumber
        ) {
          GLFW.lastGamepadState = navigator.getGamepads
            ? navigator.getGamepads()
            : navigator.webkitGetGamepads || []
          GLFW.lastGamepadStateFrame = Browser.mainLoop.currentFrameNumber
          for (var joy = 0; joy < GLFW.lastGamepadState.length; ++joy) {
            var gamepad = GLFW.lastGamepadState[joy]
            if (gamepad) {
              if (!GLFW.joys[joy]) {
                out('glfw joystick connected:', joy)
                GLFW.joys[joy] = {
                  id: stringToNewUTF8(gamepad.id),
                  buttonsCount: gamepad.buttons.length,
                  axesCount: gamepad.axes.length,
                  buttons: _malloc(gamepad.buttons.length),
                  axes: _malloc(gamepad.axes.length * 4),
                }
                if (GLFW.joystickFunc) {
                  ;((a1, a2) => dynCall_vii(GLFW.joystickFunc, a1, a2))(joy, 262145)
                }
              }
              var data = GLFW.joys[joy]
              for (var i = 0; i < gamepad.buttons.length; ++i) {
                GROWABLE_HEAP_I8()[data.buttons + i] = gamepad.buttons[i].pressed
              }
              for (var i = 0; i < gamepad.axes.length; ++i) {
                GROWABLE_HEAP_F32()[(data.axes + i * 4) >> 2] = gamepad.axes[i]
              }
            } else {
              if (GLFW.joys[joy]) {
                out('glfw joystick disconnected', joy)
                if (GLFW.joystickFunc) {
                  ;((a1, a2) => dynCall_vii(GLFW.joystickFunc, a1, a2))(joy, 262146)
                }
                _free(GLFW.joys[joy].id)
                _free(GLFW.joys[joy].buttons)
                _free(GLFW.joys[joy].axes)
                delete GLFW.joys[joy]
              }
            }
          }
        }
      },
      setKeyCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.keyFunc
        win.keyFunc = cbfun
        return prevcbfun
      },
      setCharCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.charFunc
        win.charFunc = cbfun
        return prevcbfun
      },
      setMouseButtonCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.mouseButtonFunc
        win.mouseButtonFunc = cbfun
        return prevcbfun
      },
      setCursorPosCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.cursorPosFunc
        win.cursorPosFunc = cbfun
        return prevcbfun
      },
      setScrollCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.scrollFunc
        win.scrollFunc = cbfun
        return prevcbfun
      },
      setDropCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.dropFunc
        win.dropFunc = cbfun
        return prevcbfun
      },
      onDrop: (event) => {
        if (!GLFW.active || !GLFW.active.dropFunc) return
        if (
          !event.dataTransfer ||
          !event.dataTransfer.files ||
          event.dataTransfer.files.length == 0
        )
          return
        event.preventDefault()
        var filenames = _malloc(event.dataTransfer.files.length * 4)
        var filenamesArray = []
        var count = event.dataTransfer.files.length
        // Read and save the files to emscripten's FS
        var written = 0
        var drop_dir = '.glfw_dropped_files'
        FS.createPath('/', drop_dir)
        function save(file) {
          var path = '/' + drop_dir + '/' + file.name.replace(/\//g, '_')
          var reader = new FileReader()
          reader.onloadend = (e) => {
            if (reader.readyState != 2) {
              // not DONE
              ++written
              out('failed to read dropped file: ' + file.name + ': ' + reader.error)
              return
            }
            var data = e.target.result
            FS.writeFile(path, new Uint8Array(data))
            if (++written === count) {
              ;((a1, a2, a3) => dynCall_viii(GLFW.active.dropFunc, a1, a2, a3))(
                GLFW.active.id,
                count,
                filenames
              )
              for (var i = 0; i < filenamesArray.length; ++i) {
                _free(filenamesArray[i])
              }
              _free(filenames)
            }
          }
          reader.readAsArrayBuffer(file)
          var filename = stringToNewUTF8(path)
          filenamesArray.push(filename)
          GROWABLE_HEAP_U32()[(filenames + i * 4) >> 2] = filename
        }
        for (var i = 0; i < count; ++i) {
          save(event.dataTransfer.files[i])
        }
        return false
      },
      onDragover: (event) => {
        if (!GLFW.active || !GLFW.active.dropFunc) return
        event.preventDefault()
        return false
      },
      setWindowSizeCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.windowSizeFunc
        win.windowSizeFunc = cbfun
        return prevcbfun
      },
      setWindowCloseCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.windowCloseFunc
        win.windowCloseFunc = cbfun
        return prevcbfun
      },
      setWindowRefreshCallback: (winid, cbfun) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return null
        var prevcbfun = win.windowRefreshFunc
        win.windowRefreshFunc = cbfun
        return prevcbfun
      },
      onClickRequestPointerLock: (e) => {
        if (!Browser.pointerLock && Module['canvas'].requestPointerLock) {
          Module['canvas'].requestPointerLock()
          e.preventDefault()
        }
      },
      setInputMode: (winid, mode, value) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return
        switch (mode) {
          case 208897: {
            // GLFW_CURSOR
            switch (value) {
              case 212993: {
                // GLFW_CURSOR_NORMAL
                win.inputModes[mode] = value
                Module['canvas'].removeEventListener('click', GLFW.onClickRequestPointerLock, true)
                Module['canvas'].exitPointerLock()
                break
              }

              case 212994: {
                // GLFW_CURSOR_HIDDEN
                err('glfwSetInputMode called with GLFW_CURSOR_HIDDEN value not implemented')
                break
              }

              case 212995: {
                // GLFW_CURSOR_DISABLED
                win.inputModes[mode] = value
                Module['canvas'].addEventListener('click', GLFW.onClickRequestPointerLock, true)
                Module['canvas'].requestPointerLock()
                break
              }

              default: {
                err(`glfwSetInputMode called with unknown value parameter value: ${value}`)
                break
              }
            }
            break
          }

          case 208898: {
            // GLFW_STICKY_KEYS
            err('glfwSetInputMode called with GLFW_STICKY_KEYS mode not implemented')
            break
          }

          case 208899: {
            // GLFW_STICKY_MOUSE_BUTTONS
            err('glfwSetInputMode called with GLFW_STICKY_MOUSE_BUTTONS mode not implemented')
            break
          }

          case 208900: {
            // GLFW_LOCK_KEY_MODS
            err('glfwSetInputMode called with GLFW_LOCK_KEY_MODS mode not implemented')
            break
          }

          case 3342341: {
            // GLFW_RAW_MOUSE_MOTION
            err('glfwSetInputMode called with GLFW_RAW_MOUSE_MOTION mode not implemented')
            break
          }

          default: {
            err(`glfwSetInputMode called with unknown mode parameter value: ${mode}`)
            break
          }
        }
      },
      getKey: (winid, key) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return 0
        return win.keys[key]
      },
      getMouseButton: (winid, button) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return 0
        return (win.buttons & (1 << button)) > 0
      },
      getCursorPos: (winid, x, y) => {
        GROWABLE_HEAP_F64()[x >> 3] = Browser.mouseX
        GROWABLE_HEAP_F64()[y >> 3] = Browser.mouseY
      },
      getMousePos: (winid, x, y) => {
        GROWABLE_HEAP_I32()[x >> 2] = Browser.mouseX
        GROWABLE_HEAP_I32()[y >> 2] = Browser.mouseY
      },
      setCursorPos: (winid, x, y) => {},
      getWindowPos: (winid, x, y) => {
        var wx = 0
        var wy = 0
        var win = GLFW.WindowFromId(winid)
        if (win) {
          wx = win.x
          wy = win.y
        }
        if (x) {
          GROWABLE_HEAP_I32()[x >> 2] = wx
        }
        if (y) {
          GROWABLE_HEAP_I32()[y >> 2] = wy
        }
      },
      setWindowPos: (winid, x, y) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return
        win.x = x
        win.y = y
      },
      getWindowSize: (winid, width, height) => {
        var ww = 0
        var wh = 0
        var win = GLFW.WindowFromId(winid)
        if (win) {
          ww = win.width
          wh = win.height
        }
        if (width) {
          GROWABLE_HEAP_I32()[width >> 2] = ww
        }
        if (height) {
          GROWABLE_HEAP_I32()[height >> 2] = wh
        }
      },
      setWindowSize: (winid, width, height) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return
        if (GLFW.active.id == win.id) {
          Browser.setCanvasSize(width, height)
        }
      },
      // triggers the listener (onCanvasResize) + windowSizeFunc
      defaultWindowHints: () => {
        GLFW.hints = Object.assign({}, GLFW.defaultHints)
      },
      createWindow: (width, height, title, monitor, share) => {
        var i, id
        for (i = 0; i < GLFW.windows.length && GLFW.windows[i] !== null; i++) {}
        // no-op
        if (i > 0) throw 'glfwCreateWindow only supports one window at time currently'
        // id for window
        id = i + 1
        // not valid
        if (width <= 0 || height <= 0) return 0
        if (monitor) {
          Browser.requestFullscreen()
        } else {
          Browser.setCanvasSize(width, height)
        }
        // Create context when there are no existing alive windows
        for (i = 0; i < GLFW.windows.length && GLFW.windows[i] == null; i++) {}
        // no-op
        var useWebGL = GLFW.hints[139265] > 0
        // Use WebGL when we are told to based on GLFW_CLIENT_API
        if (i == GLFW.windows.length) {
          if (useWebGL) {
            var contextAttributes = {
              antialias: GLFW.hints[135181] > 1,
              // GLFW_SAMPLES
              depth: GLFW.hints[135173] > 0,
              // GLFW_DEPTH_BITS
              stencil: GLFW.hints[135174] > 0,
              // GLFW_STENCIL_BITS
              alpha: GLFW.hints[135172] > 0,
            }
            // GLFW_ALPHA_BITS
            Module.ctx = Browser.createContext(Module['canvas'], true, true, contextAttributes)
          } else {
            Browser.init()
          }
        }
        // If context creation failed, do not return a valid window
        if (!Module.ctx && useWebGL) return 0
        // Get non alive id
        const canvas = Module['canvas']
        var win = new GLFW_Window(
          id,
          canvas.clientWidth,
          canvas.clientHeight,
          canvas.width,
          canvas.height,
          title,
          monitor,
          share
        )
        // Set window to array
        if (id - 1 == GLFW.windows.length) {
          GLFW.windows.push(win)
        } else {
          GLFW.windows[id - 1] = win
        }
        GLFW.active = win
        GLFW.adjustCanvasDimensions()
        return win.id
      },
      destroyWindow: (winid) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return
        if (win.windowCloseFunc) {
          ;((a1) => dynCall_vi(win.windowCloseFunc, a1))(win.id)
        }
        GLFW.windows[win.id - 1] = null
        if (GLFW.active.id == win.id) GLFW.active = null
        // Destroy context when no alive windows
        for (var i = 0; i < GLFW.windows.length; i++) if (GLFW.windows[i] !== null) return
        Module.ctx = Browser.destroyContext(Module['canvas'], true, true)
      },
      swapBuffers: (winid) => {},
      requestFullscreen(lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer
        Browser.resizeCanvas = resizeCanvas
        if (typeof Browser.lockPointer == 'undefined') Browser.lockPointer = true
        if (typeof Browser.resizeCanvas == 'undefined') Browser.resizeCanvas = false
        var canvas = Module['canvas']
        function fullscreenChange() {
          Browser.isFullscreen = false
          var canvasContainer = canvas.parentNode
          if (
            (document['fullscreenElement'] ||
              document['mozFullScreenElement'] ||
              document['msFullscreenElement'] ||
              document['webkitFullscreenElement'] ||
              document['webkitCurrentFullScreenElement']) === canvasContainer
          ) {
            canvas.exitFullscreen = Browser.exitFullscreen
            if (Browser.lockPointer) canvas.requestPointerLock()
            Browser.isFullscreen = true
            if (Browser.resizeCanvas) {
              Browser.setFullscreenCanvasSize()
            } else {
              Browser.updateCanvasDimensions(canvas)
              Browser.updateResizeListeners()
            }
          } else {
            // remove the full screen specific parent of the canvas again to restore the HTML structure from before going full screen
            canvasContainer.parentNode.insertBefore(canvas, canvasContainer)
            canvasContainer.parentNode.removeChild(canvasContainer)
            if (Browser.resizeCanvas) {
              Browser.setWindowedCanvasSize()
            } else {
              Browser.updateCanvasDimensions(canvas)
              Browser.updateResizeListeners()
            }
          }
          Module['onFullScreen']?.(Browser.isFullscreen)
          Module['onFullscreen']?.(Browser.isFullscreen)
        }
        if (!Browser.fullscreenHandlersInstalled) {
          Browser.fullscreenHandlersInstalled = true
          document.addEventListener('fullscreenchange', fullscreenChange, false)
          document.addEventListener('mozfullscreenchange', fullscreenChange, false)
          document.addEventListener('webkitfullscreenchange', fullscreenChange, false)
          document.addEventListener('MSFullscreenChange', fullscreenChange, false)
        }
        // create a new parent to ensure the canvas has no siblings. this allows browsers to optimize full screen performance when its parent is the full screen root
        var canvasContainer = document.createElement('div')
        canvas.parentNode.insertBefore(canvasContainer, canvas)
        canvasContainer.appendChild(canvas)
        // use parent of canvas as full screen root to allow aspect ratio correction (Firefox stretches the root to screen size)
        canvasContainer.requestFullscreen =
          canvasContainer['requestFullscreen'] ||
          canvasContainer['mozRequestFullScreen'] ||
          canvasContainer['msRequestFullscreen'] ||
          (canvasContainer['webkitRequestFullscreen']
            ? () => canvasContainer['webkitRequestFullscreen'](Element['ALLOW_KEYBOARD_INPUT'])
            : null) ||
          (canvasContainer['webkitRequestFullScreen']
            ? () => canvasContainer['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT'])
            : null)
        canvasContainer.requestFullscreen()
      },
      updateCanvasDimensions(canvas, wNative, hNative) {
        const scale = GLFW.getHiDPIScale()
        if (wNative && hNative) {
          canvas.widthNative = wNative
          canvas.heightNative = hNative
        } else {
          wNative = canvas.widthNative
          hNative = canvas.heightNative
        }
        var w = wNative
        var h = hNative
        if (Module['forcedAspectRatio'] && Module['forcedAspectRatio'] > 0) {
          if (w / h < Module['forcedAspectRatio']) {
            w = Math.round(h * Module['forcedAspectRatio'])
          } else {
            h = Math.round(w / Module['forcedAspectRatio'])
          }
        }
        if (
          (document['fullscreenElement'] ||
            document['mozFullScreenElement'] ||
            document['msFullscreenElement'] ||
            document['webkitFullscreenElement'] ||
            document['webkitCurrentFullScreenElement']) === canvas.parentNode &&
          typeof screen != 'undefined'
        ) {
          var factor = Math.min(screen.width / w, screen.height / h)
          w = Math.round(w * factor)
          h = Math.round(h * factor)
        }
        if (Browser.resizeCanvas) {
          wNative = w
          hNative = h
        }
        const wNativeScaled = Math.floor(wNative * scale)
        const hNativeScaled = Math.floor(hNative * scale)
        if (canvas.width != wNativeScaled) canvas.width = wNativeScaled
        if (canvas.height != hNativeScaled) canvas.height = hNativeScaled
        if (typeof canvas.style != 'undefined') {
          if (wNativeScaled != wNative || hNativeScaled != hNative) {
            canvas.style.setProperty('width', wNative + 'px', 'important')
            canvas.style.setProperty('height', hNative + 'px', 'important')
          } else {
            canvas.style.removeProperty('width')
            canvas.style.removeProperty('height')
          }
        }
      },
      calculateMouseCoords(pageX, pageY) {
        // Calculate the movement based on the changes
        // in the coordinates.
        var rect = Module['canvas'].getBoundingClientRect()
        var cw = Module['canvas'].clientWidth
        var ch = Module['canvas'].clientHeight
        // Neither .scrollX or .pageXOffset are defined in a spec, but
        // we prefer .scrollX because it is currently in a spec draft.
        // (see: http://www.w3.org/TR/2013/WD-cssom-view-20131217/)
        var scrollX = typeof window.scrollX != 'undefined' ? window.scrollX : window.pageXOffset
        var scrollY = typeof window.scrollY != 'undefined' ? window.scrollY : window.pageYOffset
        var adjustedX = pageX - (scrollX + rect.left)
        var adjustedY = pageY - (scrollY + rect.top)
        // the canvas might be CSS-scaled compared to its backbuffer;
        // SDL-using content will want mouse coordinates in terms
        // of backbuffer units.
        adjustedX = adjustedX * (cw / rect.width)
        adjustedY = adjustedY * (ch / rect.height)
        return {
          x: adjustedX,
          y: adjustedY,
        }
      },
      setWindowAttrib: (winid, attrib, value) => {
        var win = GLFW.WindowFromId(winid)
        if (!win) return
        const isHiDPIAware = GLFW.isHiDPIAware()
        win.attributes[attrib] = value
        if (isHiDPIAware !== GLFW.isHiDPIAware()) GLFW.adjustCanvasDimensions()
      },
      getDevicePixelRatio() {
        return (typeof devicePixelRatio == 'number' && devicePixelRatio) || 1
      },
      isHiDPIAware() {
        if (GLFW.active)
          return GLFW.active.attributes[139276] > 0 // GLFW_SCALE_TO_MONITOR
        else return false
      },
      adjustCanvasDimensions() {
        const canvas = Module['canvas']
        Browser.updateCanvasDimensions(canvas, canvas.clientWidth, canvas.clientHeight)
        Browser.updateResizeListeners()
      },
      getHiDPIScale() {
        return GLFW.isHiDPIAware() ? GLFW.scale : 1
      },
      onDevicePixelRatioChange() {
        GLFW.onWindowContentScaleChanged(GLFW.getDevicePixelRatio())
        GLFW.adjustCanvasDimensions()
      },
      GLFW2ParamToGLFW3Param: (param) => {
        var table = {
          196609: 0,
          // GLFW_MOUSE_CURSOR
          196610: 0,
          // GLFW_STICKY_KEYS
          196611: 0,
          // GLFW_STICKY_MOUSE_BUTTONS
          196612: 0,
          // GLFW_SYSTEM_KEYS
          196613: 0,
          // GLFW_KEY_REPEAT
          196614: 0,
          // GLFW_AUTO_POLL_EVENTS
          131073: 0,
          // GLFW_OPENED
          131074: 0,
          // GLFW_ACTIVE
          131075: 0,
          // GLFW_ICONIFIED
          131076: 0,
          // GLFW_ACCELERATED
          131077: 135169,
          // GLFW_RED_BITS
          131078: 135170,
          // GLFW_GREEN_BITS
          131079: 135171,
          // GLFW_BLUE_BITS
          131080: 135172,
          // GLFW_ALPHA_BITS
          131081: 135173,
          // GLFW_DEPTH_BITS
          131082: 135174,
          // GLFW_STENCIL_BITS
          131083: 135183,
          // GLFW_REFRESH_RATE
          131084: 135175,
          // GLFW_ACCUM_RED_BITS
          131085: 135176,
          // GLFW_ACCUM_GREEN_BITS
          131086: 135177,
          // GLFW_ACCUM_BLUE_BITS
          131087: 135178,
          // GLFW_ACCUM_ALPHA_BITS
          131088: 135179,
          // GLFW_AUX_BUFFERS
          131089: 135180,
          // GLFW_STEREO
          131090: 0,
          // GLFW_WINDOW_NO_RESIZE
          131091: 135181,
          // GLFW_FSAA_SAMPLES
          131092: 139266,
          // GLFW_OPENGL_VERSION_MAJOR
          131093: 139267,
          // GLFW_OPENGL_VERSION_MINOR
          131094: 139270,
          // GLFW_OPENGL_FORWARD_COMPAT
          131095: 139271,
          // GLFW_OPENGL_DEBUG_CONTEXT
          131096: 139272,
        }
        // GLFW_OPENGL_PROFILE
        return table[param]
      },
    }

    var _glfwCreateWindow = (width, height, title, monitor, share) =>
      GLFW.createWindow(width, height, title, monitor, share)

    var _glfwDefaultWindowHints = () => GLFW.defaultWindowHints()

    var _glfwDestroyWindow = (winid) => GLFW.destroyWindow(winid)

    var _glfwGetPrimaryMonitor = () => 1

    var _glfwGetTime = () => GLFW.getTime() - GLFW.initialTime

    var _glfwGetVideoModes = (monitor, count) => {
      GROWABLE_HEAP_I32()[count >> 2] = 0
      return 0
    }

    var _glfwInit = () => {
      if (GLFW.windows) return 1
      // GL_TRUE
      GLFW.initialTime = GLFW.getTime()
      GLFW.defaultWindowHints()
      GLFW.windows = new Array()
      GLFW.active = null
      GLFW.scale = GLFW.getDevicePixelRatio()
      window.addEventListener('gamepadconnected', GLFW.onGamepadConnected, true)
      window.addEventListener('gamepaddisconnected', GLFW.onGamepadDisconnected, true)
      window.addEventListener('keydown', GLFW.onKeydown, true)
      window.addEventListener('keypress', GLFW.onKeyPress, true)
      window.addEventListener('keyup', GLFW.onKeyup, true)
      window.addEventListener('blur', GLFW.onBlur, true)
      // watch for devicePixelRatio changes
      GLFW.devicePixelRatioMQL = window.matchMedia(
        '(resolution: ' + GLFW.getDevicePixelRatio() + 'dppx)'
      )
      GLFW.devicePixelRatioMQL.addEventListener('change', GLFW.onDevicePixelRatioChange)
      Module['canvas'].addEventListener('touchmove', GLFW.onMousemove, true)
      Module['canvas'].addEventListener('touchstart', GLFW.onMouseButtonDown, true)
      Module['canvas'].addEventListener('touchcancel', GLFW.onMouseButtonUp, true)
      Module['canvas'].addEventListener('touchend', GLFW.onMouseButtonUp, true)
      Module['canvas'].addEventListener('mousemove', GLFW.onMousemove, true)
      Module['canvas'].addEventListener('mousedown', GLFW.onMouseButtonDown, true)
      Module['canvas'].addEventListener('mouseup', GLFW.onMouseButtonUp, true)
      Module['canvas'].addEventListener('wheel', GLFW.onMouseWheel, true)
      Module['canvas'].addEventListener('mousewheel', GLFW.onMouseWheel, true)
      Module['canvas'].addEventListener('mouseenter', GLFW.onMouseenter, true)
      Module['canvas'].addEventListener('mouseleave', GLFW.onMouseleave, true)
      Module['canvas'].addEventListener('drop', GLFW.onDrop, true)
      Module['canvas'].addEventListener('dragover', GLFW.onDragover, true)
      // Overriding implementation to account for HiDPI
      Browser.requestFullscreen = GLFW.requestFullscreen
      Browser.calculateMouseCoords = GLFW.calculateMouseCoords
      Browser.updateCanvasDimensions = GLFW.updateCanvasDimensions
      Browser.resizeListeners.push((width, height) => {
        if (GLFW.isHiDPIAware()) {
          var canvas = Module['canvas']
          GLFW.onCanvasResize(canvas.clientWidth, canvas.clientHeight, width, height)
        } else {
          GLFW.onCanvasResize(width, height, width, height)
        }
      })
      return 1
    }

    // GL_TRUE
    var _glfwMakeContextCurrent = (winid) => {}

    var _glfwSetCharCallback = (winid, cbfun) => GLFW.setCharCallback(winid, cbfun)

    var _glfwSetCursorEnterCallback = (winid, cbfun) => {
      var win = GLFW.WindowFromId(winid)
      if (!win) return null
      var prevcbfun = win.cursorEnterFunc
      win.cursorEnterFunc = cbfun
      return prevcbfun
    }

    var _glfwSetCursorPosCallback = (winid, cbfun) => GLFW.setCursorPosCallback(winid, cbfun)

    var _glfwSetDropCallback = (winid, cbfun) => GLFW.setDropCallback(winid, cbfun)

    var _glfwSetErrorCallback = (cbfun) => {
      var prevcbfun = GLFW.errorFunc
      GLFW.errorFunc = cbfun
      return prevcbfun
    }

    var _glfwSetKeyCallback = (winid, cbfun) => GLFW.setKeyCallback(winid, cbfun)

    var _glfwSetMouseButtonCallback = (winid, cbfun) => GLFW.setMouseButtonCallback(winid, cbfun)

    var _glfwSetScrollCallback = (winid, cbfun) => GLFW.setScrollCallback(winid, cbfun)

    var _glfwSetWindowContentScaleCallback = (winid, cbfun) => {
      var win = GLFW.WindowFromId(winid)
      if (!win) return null
      var prevcbfun = win.windowContentScaleFunc
      win.windowContentScaleFunc = cbfun
      return prevcbfun
    }

    var _glfwSetWindowFocusCallback = (winid, cbfun) => {
      var win = GLFW.WindowFromId(winid)
      if (!win) return null
      var prevcbfun = win.windowFocusFunc
      win.windowFocusFunc = cbfun
      return prevcbfun
    }

    var _glfwSetWindowIconifyCallback = (winid, cbfun) => {
      var win = GLFW.WindowFromId(winid)
      if (!win) return null
      var prevcbfun = win.windowIconifyFunc
      win.windowIconifyFunc = cbfun
      return prevcbfun
    }

    var _glfwSetWindowShouldClose = (winid, value) => {
      var win = GLFW.WindowFromId(winid)
      if (!win) return
      win.shouldClose = value
    }

    var _glfwSetWindowSizeCallback = (winid, cbfun) => GLFW.setWindowSizeCallback(winid, cbfun)

    var _glfwSwapBuffers = (winid) => GLFW.swapBuffers(winid)

    var _glfwTerminate = () => {
      window.removeEventListener('gamepadconnected', GLFW.onGamepadConnected, true)
      window.removeEventListener('gamepaddisconnected', GLFW.onGamepadDisconnected, true)
      window.removeEventListener('keydown', GLFW.onKeydown, true)
      window.removeEventListener('keypress', GLFW.onKeyPress, true)
      window.removeEventListener('keyup', GLFW.onKeyup, true)
      window.removeEventListener('blur', GLFW.onBlur, true)
      Module['canvas'].removeEventListener('touchmove', GLFW.onMousemove, true)
      Module['canvas'].removeEventListener('touchstart', GLFW.onMouseButtonDown, true)
      Module['canvas'].removeEventListener('touchcancel', GLFW.onMouseButtonUp, true)
      Module['canvas'].removeEventListener('touchend', GLFW.onMouseButtonUp, true)
      Module['canvas'].removeEventListener('mousemove', GLFW.onMousemove, true)
      Module['canvas'].removeEventListener('mousedown', GLFW.onMouseButtonDown, true)
      Module['canvas'].removeEventListener('mouseup', GLFW.onMouseButtonUp, true)
      Module['canvas'].removeEventListener('wheel', GLFW.onMouseWheel, true)
      Module['canvas'].removeEventListener('mousewheel', GLFW.onMouseWheel, true)
      Module['canvas'].removeEventListener('mouseenter', GLFW.onMouseenter, true)
      Module['canvas'].removeEventListener('mouseleave', GLFW.onMouseleave, true)
      Module['canvas'].removeEventListener('drop', GLFW.onDrop, true)
      Module['canvas'].removeEventListener('dragover', GLFW.onDragover, true)
      if (GLFW.devicePixelRatioMQL)
        GLFW.devicePixelRatioMQL.removeEventListener('change', GLFW.onDevicePixelRatioChange)
      Module['canvas'].width = Module['canvas'].height = 1
      GLFW.windows = null
      GLFW.active = null
    }

    var _glfwWindowHint = (target, hint) => {
      GLFW.hints[target] = hint
    }

    var stringToUTF8OnStack = (str) => {
      var size = lengthBytesUTF8(str) + 1
      var ret = stackAlloc(size)
      stringToUTF8(str, ret, size)
      return ret
    }

    var runAndAbortIfError = (func) => {
      try {
        return func()
      } catch (e) {
        abort(e)
      }
    }

    var Asyncify = {
      instrumentWasmImports(imports) {
        var importPattern = /^(invoke_.*|__asyncjs__.*)$/
        for (let [x, original] of Object.entries(imports)) {
          if (typeof original == 'function') {
            let isAsyncifyImport = original.isAsync || importPattern.test(x)
          }
        }
      },
      instrumentWasmExports(exports) {
        var ret = {}
        for (let [x, original] of Object.entries(exports)) {
          if (typeof original == 'function') {
            ret[x] = (...args) => {
              Asyncify.exportCallStack.push(x)
              try {
                return original(...args)
              } finally {
                if (!ABORT) {
                  var y = Asyncify.exportCallStack.pop()
                  Asyncify.maybeStopUnwind()
                }
              }
            }
          } else {
            ret[x] = original
          }
        }
        return ret
      },
      State: {
        Normal: 0,
        Unwinding: 1,
        Rewinding: 2,
        Disabled: 3,
      },
      state: 0,
      StackSize: 4096,
      currData: null,
      handleSleepReturnValue: 0,
      exportCallStack: [],
      callStackNameToId: {},
      callStackIdToName: {},
      callStackId: 0,
      asyncPromiseHandlers: null,
      sleepCallbacks: [],
      getCallStackId(funcName) {
        var id = Asyncify.callStackNameToId[funcName]
        if (id === undefined) {
          id = Asyncify.callStackId++
          Asyncify.callStackNameToId[funcName] = id
          Asyncify.callStackIdToName[id] = funcName
        }
        return id
      },
      maybeStopUnwind() {
        if (
          Asyncify.currData &&
          Asyncify.state === Asyncify.State.Unwinding &&
          Asyncify.exportCallStack.length === 0
        ) {
          // We just finished unwinding.
          // Be sure to set the state before calling any other functions to avoid
          // possible infinite recursion here (For example in debug pthread builds
          // the dbg() function itself can call back into WebAssembly to get the
          // current pthread_self() pointer).
          Asyncify.state = Asyncify.State.Normal
          runtimeKeepalivePush()
          // Keep the runtime alive so that a re-wind can be done later.
          runAndAbortIfError(_asyncify_stop_unwind)
          if (typeof Fibers != 'undefined') {
            Fibers.trampoline()
          }
        }
      },
      whenDone() {
        return new Promise((resolve, reject) => {
          Asyncify.asyncPromiseHandlers = {
            resolve: resolve,
            reject: reject,
          }
        })
      },
      allocateData() {
        // An asyncify data structure has three fields:
        //  0  current stack pos
        //  4  max stack pos
        //  8  id of function at bottom of the call stack (callStackIdToName[id] == name of js function)
        // The Asyncify ABI only interprets the first two fields, the rest is for the runtime.
        // We also embed a stack in the same memory region here, right next to the structure.
        // This struct is also defined as asyncify_data_t in emscripten/fiber.h
        var ptr = _malloc(12 + Asyncify.StackSize)
        Asyncify.setDataHeader(ptr, ptr + 12, Asyncify.StackSize)
        Asyncify.setDataRewindFunc(ptr)
        return ptr
      },
      setDataHeader(ptr, stack, stackSize) {
        GROWABLE_HEAP_U32()[ptr >> 2] = stack
        GROWABLE_HEAP_U32()[(ptr + 4) >> 2] = stack + stackSize
      },
      setDataRewindFunc(ptr) {
        var bottomOfCallStack = Asyncify.exportCallStack[0]
        var rewindId = Asyncify.getCallStackId(bottomOfCallStack)
        GROWABLE_HEAP_I32()[(ptr + 8) >> 2] = rewindId
      },
      getDataRewindFuncName(ptr) {
        var id = GROWABLE_HEAP_I32()[(ptr + 8) >> 2]
        var name = Asyncify.callStackIdToName[id]
        return name
      },
      getDataRewindFunc(name) {
        var func = wasmExports[name]
        return func
      },
      doRewind(ptr) {
        var name = Asyncify.getDataRewindFuncName(ptr)
        var func = Asyncify.getDataRewindFunc(name)
        // Once we have rewound and the stack we no longer need to artificially
        // keep the runtime alive.
        runtimeKeepalivePop()
        return func()
      },
      handleSleep(startAsync) {
        if (ABORT) return
        if (Asyncify.state === Asyncify.State.Normal) {
          // Prepare to sleep. Call startAsync, and see what happens:
          // if the code decided to call our callback synchronously,
          // then no async operation was in fact begun, and we don't
          // need to do anything.
          var reachedCallback = false
          var reachedAfterCallback = false
          startAsync((handleSleepReturnValue = 0) => {
            if (ABORT) return
            Asyncify.handleSleepReturnValue = handleSleepReturnValue
            reachedCallback = true
            if (!reachedAfterCallback) {
              // We are happening synchronously, so no need for async.
              return
            }
            Asyncify.state = Asyncify.State.Rewinding
            runAndAbortIfError(() => _asyncify_start_rewind(Asyncify.currData))
            if (typeof Browser != 'undefined' && Browser.mainLoop.func) {
              Browser.mainLoop.resume()
            }
            var asyncWasmReturnValue,
              isError = false
            try {
              asyncWasmReturnValue = Asyncify.doRewind(Asyncify.currData)
            } catch (err) {
              asyncWasmReturnValue = err
              isError = true
            }
            // Track whether the return value was handled by any promise handlers.
            var handled = false
            if (!Asyncify.currData) {
              // All asynchronous execution has finished.
              // `asyncWasmReturnValue` now contains the final
              // return value of the exported async WASM function.
              // Note: `asyncWasmReturnValue` is distinct from
              // `Asyncify.handleSleepReturnValue`.
              // `Asyncify.handleSleepReturnValue` contains the return
              // value of the last C function to have executed
              // `Asyncify.handleSleep()`, where as `asyncWasmReturnValue`
              // contains the return value of the exported WASM function
              // that may have called C functions that
              // call `Asyncify.handleSleep()`.
              var asyncPromiseHandlers = Asyncify.asyncPromiseHandlers
              if (asyncPromiseHandlers) {
                Asyncify.asyncPromiseHandlers = null
                ;(isError ? asyncPromiseHandlers.reject : asyncPromiseHandlers.resolve)(
                  asyncWasmReturnValue
                )
                handled = true
              }
            }
            if (isError && !handled) {
              // If there was an error and it was not handled by now, we have no choice but to
              // rethrow that error into the global scope where it can be caught only by
              // `onerror` or `onunhandledpromiserejection`.
              throw asyncWasmReturnValue
            }
          })
          reachedAfterCallback = true
          if (!reachedCallback) {
            // A true async operation was begun; start a sleep.
            Asyncify.state = Asyncify.State.Unwinding
            // TODO: reuse, don't alloc/free every sleep
            Asyncify.currData = Asyncify.allocateData()
            if (typeof Browser != 'undefined' && Browser.mainLoop.func) {
              Browser.mainLoop.pause()
            }
            runAndAbortIfError(() => _asyncify_start_unwind(Asyncify.currData))
          }
        } else if (Asyncify.state === Asyncify.State.Rewinding) {
          // Stop a resume.
          Asyncify.state = Asyncify.State.Normal
          runAndAbortIfError(_asyncify_stop_rewind)
          _free(Asyncify.currData)
          Asyncify.currData = null
          // Call all sleep callbacks now that the sleep-resume is all done.
          Asyncify.sleepCallbacks.forEach(callUserCallback)
        } else {
          abort(`invalid state: ${Asyncify.state}`)
        }
        return Asyncify.handleSleepReturnValue
      },
      handleAsync(startAsync) {
        return Asyncify.handleSleep((wakeUp) => {
          // TODO: add error handling as a second param when handleSleep implements it.
          startAsync().then(wakeUp)
        })
      },
    }

    var FS_createPath = FS.createPath

    var FS_unlink = (path) => FS.unlink(path)

    var FS_createLazyFile = FS.createLazyFile

    var FS_createDevice = FS.createDevice

    PThread.init()

    FS.createPreloadedFile = FS_createPreloadedFile

    FS.staticInit()

    Module['FS_createPath'] = FS.createPath

    Module['FS_createDataFile'] = FS.createDataFile

    Module['FS_createPreloadedFile'] = FS.createPreloadedFile

    Module['FS_unlink'] = FS.unlink

    Module['FS_createLazyFile'] = FS.createLazyFile

    Module['FS_createDevice'] = FS.createDevice

    var GLctx

    for (var i = 0; i < 32; ++i) tempFixedLengthArray.push(new Array(i))

    var miniTempWebGLFloatBuffersStorage = new Float32Array(288)

    // Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
    for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
      miniTempWebGLFloatBuffers[i] = miniTempWebGLFloatBuffersStorage.subarray(0, i)
    }

    var miniTempWebGLIntBuffersStorage = new Int32Array(288)

    // Create GL_POOL_TEMP_BUFFERS_SIZE+1 temporary buffers, for uploads of size 0 through GL_POOL_TEMP_BUFFERS_SIZE inclusive
    for (/**@suppress{duplicate}*/ var i = 0; i <= 288; ++i) {
      miniTempWebGLIntBuffers[i] = miniTempWebGLIntBuffersStorage.subarray(0, i)
    }

    // exports
    Module['requestFullscreen'] = Browser.requestFullscreen

    Module['requestAnimationFrame'] = Browser.requestAnimationFrame

    Module['setCanvasSize'] = Browser.setCanvasSize

    Module['pauseMainLoop'] = Browser.mainLoop.pause

    Module['resumeMainLoop'] = Browser.mainLoop.resume

    Module['getUserMedia'] = Browser.getUserMedia

    Module['createContext'] = Browser.createContext

    var preloadedImages = {}

    var preloadedAudios = {}

    // proxiedFunctionTable specifies the list of functions that can be called
    // either synchronously or asynchronously from other threads in postMessage()d
    // or internally queued events. This way a pthread in a Worker can synchronously
    // access e.g. the DOM on the main thread.
    var proxiedFunctionTable = [
      _proc_exit,
      exitOnMainThread,
      pthreadCreateProxied,
      ___syscall_faccessat,
      ___syscall_fcntl64,
      ___syscall_getcwd,
      ___syscall_ioctl,
      ___syscall_openat,
      _emscripten_force_exit,
      __emscripten_runtime_keepalive_clear,
      _emscripten_get_element_css_size,
      _emscripten_get_gamepad_status,
      _emscripten_get_num_gamepads,
      _emscripten_sample_gamepad_data,
      setCanvasElementSizeMainThread,
      _emscripten_set_click_callback_on_thread,
      _emscripten_set_fullscreenchange_callback_on_thread,
      _emscripten_set_gamepadconnected_callback_on_thread,
      _emscripten_set_gamepaddisconnected_callback_on_thread,
      _emscripten_set_mousemove_callback_on_thread,
      _emscripten_set_pointerlockchange_callback_on_thread,
      _emscripten_set_resize_callback_on_thread,
      _emscripten_set_touchcancel_callback_on_thread,
      _emscripten_set_touchend_callback_on_thread,
      _emscripten_set_touchmove_callback_on_thread,
      _emscripten_set_touchstart_callback_on_thread,
      _emscripten_set_window_title,
      _fd_close,
      _fd_read,
      _fd_seek,
      _fd_write,
    ]

    var wasmImports

    function assignWasmImports() {
      wasmImports = {
        /** @export */ ga: GetWindowInnerHeight,
        /** @export */ ha: GetWindowInnerWidth,
        /** @export */ b: ___assert_fail,
        /** @export */ Md: ___pthread_create_js,
        /** @export */ Na: ___syscall_faccessat,
        /** @export */ P: ___syscall_fcntl64,
        /** @export */ Pa: ___syscall_getcwd,
        /** @export */ sc: ___syscall_ioctl,
        /** @export */ Oc: ___syscall_openat,
        /** @export */ re: __emscripten_fs_load_embedded_files,
        /** @export */ tc: __emscripten_get_now_is_monotonic,
        /** @export */ oa: __emscripten_init_main_thread_js,
        /** @export */ Ga: __emscripten_notify_mailbox_postmessage,
        /** @export */ ua: __emscripten_receive_on_main_thread_js,
        /** @export */ R: __emscripten_thread_cleanup,
        /** @export */ ia: __emscripten_thread_mailbox_await,
        /** @export */ Z: __emscripten_thread_set_strongref,
        /** @export */ f: _emscripten_asm_const_int,
        /** @export */ J: _emscripten_check_blocking_allowed,
        /** @export */ S: _emscripten_date_now,
        /** @export */ qe: _emscripten_exit_with_live_runtime,
        /** @export */ Ma: _emscripten_force_exit,
        /** @export */ Qa: _emscripten_get_element_css_size,
        /** @export */ aa: _emscripten_get_gamepad_status,
        /** @export */ h: _emscripten_get_now,
        /** @export */ ba: _emscripten_get_num_gamepads,
        /** @export */ Pd: _emscripten_glActiveTexture,
        /** @export */ Od: _emscripten_glAttachShader,
        /** @export */ de: _emscripten_glBeginQueryEXT,
        /** @export */ Nd: _emscripten_glBindAttribLocation,
        /** @export */ Ld: _emscripten_glBindBuffer,
        /** @export */ Kd: _emscripten_glBindFramebuffer,
        /** @export */ Jd: _emscripten_glBindRenderbuffer,
        /** @export */ Id: _emscripten_glBindTexture,
        /** @export */ Xd: _emscripten_glBindVertexArrayOES,
        /** @export */ Hd: _emscripten_glBlendColor,
        /** @export */ Gd: _emscripten_glBlendEquation,
        /** @export */ Fd: _emscripten_glBlendEquationSeparate,
        /** @export */ Ed: _emscripten_glBlendFunc,
        /** @export */ Dd: _emscripten_glBlendFuncSeparate,
        /** @export */ Cd: _emscripten_glBufferData,
        /** @export */ Bd: _emscripten_glBufferSubData,
        /** @export */ Ad: _emscripten_glCheckFramebufferStatus,
        /** @export */ zd: _emscripten_glClear,
        /** @export */ yd: _emscripten_glClearColor,
        /** @export */ xd: _emscripten_glClearDepthf,
        /** @export */ wd: _emscripten_glClearStencil,
        /** @export */ vd: _emscripten_glColorMask,
        /** @export */ ud: _emscripten_glCompileShader,
        /** @export */ td: _emscripten_glCompressedTexImage2D,
        /** @export */ sd: _emscripten_glCompressedTexSubImage2D,
        /** @export */ rd: _emscripten_glCopyTexImage2D,
        /** @export */ qd: _emscripten_glCopyTexSubImage2D,
        /** @export */ pd: _emscripten_glCreateProgram,
        /** @export */ od: _emscripten_glCreateShader,
        /** @export */ nd: _emscripten_glCullFace,
        /** @export */ md: _emscripten_glDeleteBuffers,
        /** @export */ ld: _emscripten_glDeleteFramebuffers,
        /** @export */ kd: _emscripten_glDeleteProgram,
        /** @export */ ge: _emscripten_glDeleteQueriesEXT,
        /** @export */ jd: _emscripten_glDeleteRenderbuffers,
        /** @export */ id: _emscripten_glDeleteShader,
        /** @export */ hd: _emscripten_glDeleteTextures,
        /** @export */ Wd: _emscripten_glDeleteVertexArraysOES,
        /** @export */ gd: _emscripten_glDepthFunc,
        /** @export */ fd: _emscripten_glDepthMask,
        /** @export */ ed: _emscripten_glDepthRangef,
        /** @export */ dd: _emscripten_glDetachShader,
        /** @export */ cd: _emscripten_glDisable,
        /** @export */ bd: _emscripten_glDisableVertexAttribArray,
        /** @export */ ad: _emscripten_glDrawArrays,
        /** @export */ Sd: _emscripten_glDrawArraysInstancedANGLE,
        /** @export */ Td: _emscripten_glDrawBuffersWEBGL,
        /** @export */ $c: _emscripten_glDrawElements,
        /** @export */ Rd: _emscripten_glDrawElementsInstancedANGLE,
        /** @export */ _c: _emscripten_glEnable,
        /** @export */ Yc: _emscripten_glEnableVertexAttribArray,
        /** @export */ ce: _emscripten_glEndQueryEXT,
        /** @export */ Xc: _emscripten_glFinish,
        /** @export */ Wc: _emscripten_glFlush,
        /** @export */ Vc: _emscripten_glFramebufferRenderbuffer,
        /** @export */ Uc: _emscripten_glFramebufferTexture2D,
        /** @export */ Tc: _emscripten_glFrontFace,
        /** @export */ Sc: _emscripten_glGenBuffers,
        /** @export */ Qc: _emscripten_glGenFramebuffers,
        /** @export */ he: _emscripten_glGenQueriesEXT,
        /** @export */ Pc: _emscripten_glGenRenderbuffers,
        /** @export */ Nc: _emscripten_glGenTextures,
        /** @export */ Vd: _emscripten_glGenVertexArraysOES,
        /** @export */ Rc: _emscripten_glGenerateMipmap,
        /** @export */ Mc: _emscripten_glGetActiveAttrib,
        /** @export */ Lc: _emscripten_glGetActiveUniform,
        /** @export */ Kc: _emscripten_glGetAttachedShaders,
        /** @export */ Jc: _emscripten_glGetAttribLocation,
        /** @export */ Ic: _emscripten_glGetBooleanv,
        /** @export */ Hc: _emscripten_glGetBufferParameteriv,
        /** @export */ Gc: _emscripten_glGetError,
        /** @export */ Fc: _emscripten_glGetFloatv,
        /** @export */ Ec: _emscripten_glGetFramebufferAttachmentParameteriv,
        /** @export */ Dc: _emscripten_glGetIntegerv,
        /** @export */ Bc: _emscripten_glGetProgramInfoLog,
        /** @export */ Cc: _emscripten_glGetProgramiv,
        /** @export */ Zd: _emscripten_glGetQueryObjecti64vEXT,
        /** @export */ $d: _emscripten_glGetQueryObjectivEXT,
        /** @export */ Yd: _emscripten_glGetQueryObjectui64vEXT,
        /** @export */ _d: _emscripten_glGetQueryObjectuivEXT,
        /** @export */ ae: _emscripten_glGetQueryivEXT,
        /** @export */ Ac: _emscripten_glGetRenderbufferParameteriv,
        /** @export */ yc: _emscripten_glGetShaderInfoLog,
        /** @export */ xc: _emscripten_glGetShaderPrecisionFormat,
        /** @export */ wc: _emscripten_glGetShaderSource,
        /** @export */ zc: _emscripten_glGetShaderiv,
        /** @export */ vc: _emscripten_glGetString,
        /** @export */ uc: _emscripten_glGetTexParameterfv,
        /** @export */ rc: _emscripten_glGetTexParameteriv,
        /** @export */ oc: _emscripten_glGetUniformLocation,
        /** @export */ qc: _emscripten_glGetUniformfv,
        /** @export */ pc: _emscripten_glGetUniformiv,
        /** @export */ lc: _emscripten_glGetVertexAttribPointerv,
        /** @export */ nc: _emscripten_glGetVertexAttribfv,
        /** @export */ mc: _emscripten_glGetVertexAttribiv,
        /** @export */ kc: _emscripten_glHint,
        /** @export */ jc: _emscripten_glIsBuffer,
        /** @export */ ic: _emscripten_glIsEnabled,
        /** @export */ gc: _emscripten_glIsFramebuffer,
        /** @export */ fc: _emscripten_glIsProgram,
        /** @export */ ee: _emscripten_glIsQueryEXT,
        /** @export */ ec: _emscripten_glIsRenderbuffer,
        /** @export */ dc: _emscripten_glIsShader,
        /** @export */ cc: _emscripten_glIsTexture,
        /** @export */ Ud: _emscripten_glIsVertexArrayOES,
        /** @export */ bc: _emscripten_glLineWidth,
        /** @export */ ac: _emscripten_glLinkProgram,
        /** @export */ $b: _emscripten_glPixelStorei,
        /** @export */ _b: _emscripten_glPolygonOffset,
        /** @export */ be: _emscripten_glQueryCounterEXT,
        /** @export */ Zb: _emscripten_glReadPixels,
        /** @export */ Yb: _emscripten_glReleaseShaderCompiler,
        /** @export */ Xb: _emscripten_glRenderbufferStorage,
        /** @export */ Wb: _emscripten_glSampleCoverage,
        /** @export */ Vb: _emscripten_glScissor,
        /** @export */ Ub: _emscripten_glShaderBinary,
        /** @export */ Tb: _emscripten_glShaderSource,
        /** @export */ Sb: _emscripten_glStencilFunc,
        /** @export */ Rb: _emscripten_glStencilFuncSeparate,
        /** @export */ Qb: _emscripten_glStencilMask,
        /** @export */ Pb: _emscripten_glStencilMaskSeparate,
        /** @export */ Nb: _emscripten_glStencilOp,
        /** @export */ Mb: _emscripten_glStencilOpSeparate,
        /** @export */ Lb: _emscripten_glTexImage2D,
        /** @export */ Kb: _emscripten_glTexParameterf,
        /** @export */ Jb: _emscripten_glTexParameterfv,
        /** @export */ Ib: _emscripten_glTexParameteri,
        /** @export */ Hb: _emscripten_glTexParameteriv,
        /** @export */ Gb: _emscripten_glTexSubImage2D,
        /** @export */ Fb: _emscripten_glUniform1f,
        /** @export */ Eb: _emscripten_glUniform1fv,
        /** @export */ Db: _emscripten_glUniform1i,
        /** @export */ Cb: _emscripten_glUniform1iv,
        /** @export */ Bb: _emscripten_glUniform2f,
        /** @export */ Ab: _emscripten_glUniform2fv,
        /** @export */ zb: _emscripten_glUniform2i,
        /** @export */ yb: _emscripten_glUniform2iv,
        /** @export */ xb: _emscripten_glUniform3f,
        /** @export */ wb: _emscripten_glUniform3fv,
        /** @export */ vb: _emscripten_glUniform3i,
        /** @export */ ub: _emscripten_glUniform3iv,
        /** @export */ tb: _emscripten_glUniform4f,
        /** @export */ sb: _emscripten_glUniform4fv,
        /** @export */ rb: _emscripten_glUniform4i,
        /** @export */ qb: _emscripten_glUniform4iv,
        /** @export */ pb: _emscripten_glUniformMatrix2fv,
        /** @export */ ob: _emscripten_glUniformMatrix3fv,
        /** @export */ nb: _emscripten_glUniformMatrix4fv,
        /** @export */ mb: _emscripten_glUseProgram,
        /** @export */ lb: _emscripten_glValidateProgram,
        /** @export */ kb: _emscripten_glVertexAttrib1f,
        /** @export */ jb: _emscripten_glVertexAttrib1fv,
        /** @export */ ib: _emscripten_glVertexAttrib2f,
        /** @export */ hb: _emscripten_glVertexAttrib2fv,
        /** @export */ gb: _emscripten_glVertexAttrib3f,
        /** @export */ fb: _emscripten_glVertexAttrib3fv,
        /** @export */ eb: _emscripten_glVertexAttrib4f,
        /** @export */ db: _emscripten_glVertexAttrib4fv,
        /** @export */ Qd: _emscripten_glVertexAttribDivisorANGLE,
        /** @export */ cb: _emscripten_glVertexAttribPointer,
        /** @export */ bb: _emscripten_glViewport,
        /** @export */ fe: _emscripten_resize_heap,
        /** @export */ c: _emscripten_return_address,
        /** @export */ ca: _emscripten_sample_gamepad_data,
        /** @export */ fa: _emscripten_set_canvas_element_size,
        /** @export */ _a: _emscripten_set_click_callback_on_thread,
        /** @export */ ab: _emscripten_set_fullscreenchange_callback_on_thread,
        /** @export */ Ta: _emscripten_set_gamepadconnected_callback_on_thread,
        /** @export */ Sa: _emscripten_set_gamepaddisconnected_callback_on_thread,
        /** @export */ Ya: _emscripten_set_mousemove_callback_on_thread,
        /** @export */ Za: _emscripten_set_pointerlockchange_callback_on_thread,
        /** @export */ $a: _emscripten_set_resize_callback_on_thread,
        /** @export */ Ua: _emscripten_set_touchcancel_callback_on_thread,
        /** @export */ Wa: _emscripten_set_touchend_callback_on_thread,
        /** @export */ Va: _emscripten_set_touchmove_callback_on_thread,
        /** @export */ Xa: _emscripten_set_touchstart_callback_on_thread,
        /** @export */ ja: _emscripten_set_window_title,
        /** @export */ ka: _emscripten_sleep,
        /** @export */ Q: _exit,
        /** @export */ O: _fd_close,
        /** @export */ hc: _fd_read,
        /** @export */ La: _fd_seek,
        /** @export */ y: _fd_write,
        /** @export */ Zc: _getentropy,
        /** @export */ N: _glActiveTexture,
        /** @export */ D: _glAttachShader,
        /** @export */ l: _glBindAttribLocation,
        /** @export */ e: _glBindBuffer,
        /** @export */ i: _glBindTexture,
        /** @export */ Ca: _glBlendFunc,
        /** @export */ o: _glBufferData,
        /** @export */ s: _glBufferSubData,
        /** @export */ K: _glClear,
        /** @export */ L: _glClearColor,
        /** @export */ za: _glClearDepthf,
        /** @export */ qa: _glCompileShader,
        /** @export */ va: _glCompressedTexImage2D,
        /** @export */ na: _glCreateProgram,
        /** @export */ sa: _glCreateShader,
        /** @export */ Fa: _glCullFace,
        /** @export */ n: _glDeleteBuffers,
        /** @export */ F: _glDeleteProgram,
        /** @export */ G: _glDeleteShader,
        /** @export */ I: _glDeleteTextures,
        /** @export */ Ba: _glDepthFunc,
        /** @export */ H: _glDetachShader,
        /** @export */ M: _glDisable,
        /** @export */ r: _glDisableVertexAttribArray,
        /** @export */ Ia: _glDrawArrays,
        /** @export */ Ha: _glDrawElements,
        /** @export */ v: _glEnable,
        /** @export */ j: _glEnableVertexAttribArray,
        /** @export */ Aa: _glFrontFace,
        /** @export */ p: _glGenBuffers,
        /** @export */ xa: _glGenTextures,
        /** @export */ u: _glGetAttribLocation,
        /** @export */ Da: _glGetFloatv,
        /** @export */ la: _glGetProgramInfoLog,
        /** @export */ C: _glGetProgramiv,
        /** @export */ pa: _glGetShaderInfoLog,
        /** @export */ E: _glGetShaderiv,
        /** @export */ m: _glGetString,
        /** @export */ t: _glGetUniformLocation,
        /** @export */ ma: _glLinkProgram,
        /** @export */ ya: _glPixelStorei,
        /** @export */ ta: _glReadPixels,
        /** @export */ Ea: _glScissor,
        /** @export */ ra: _glShaderSource,
        /** @export */ wa: _glTexImage2D,
        /** @export */ w: _glTexParameterf,
        /** @export */ g: _glTexParameteri,
        /** @export */ Ja: _glUniform1i,
        /** @export */ Ka: _glUniform4f,
        /** @export */ q: _glUniformMatrix4fv,
        /** @export */ x: _glUseProgram,
        /** @export */ k: _glVertexAttribPointer,
        /** @export */ Ob: _glViewport,
        /** @export */ A: _glfwCreateWindow,
        /** @export */ Y: _glfwDefaultWindowHints,
        /** @export */ Oa: _glfwDestroyWindow,
        /** @export */ B: _glfwGetPrimaryMonitor,
        /** @export */ da: _glfwGetTime,
        /** @export */ X: _glfwGetVideoModes,
        /** @export */ _: _glfwInit,
        /** @export */ ie: _glfwMakeContextCurrent,
        /** @export */ ne: _glfwSetCharCallback,
        /** @export */ je: _glfwSetCursorEnterCallback,
        /** @export */ le: _glfwSetCursorPosCallback,
        /** @export */ T: _glfwSetDropCallback,
        /** @export */ $: _glfwSetErrorCallback,
        /** @export */ oe: _glfwSetKeyCallback,
        /** @export */ me: _glfwSetMouseButtonCallback,
        /** @export */ ke: _glfwSetScrollCallback,
        /** @export */ pe: _glfwSetWindowContentScaleCallback,
        /** @export */ U: _glfwSetWindowFocusCallback,
        /** @export */ V: _glfwSetWindowIconifyCallback,
        /** @export */ Ra: _glfwSetWindowShouldClose,
        /** @export */ W: _glfwSetWindowSizeCallback,
        /** @export */ ea: _glfwSwapBuffers,
        /** @export */ z: _glfwTerminate,
        /** @export */ d: _glfwWindowHint,
        /** @export */ a: wasmMemory,
      }
    }

    var wasmExports = createWasm()

    var ___wasm_call_ctors = () => (___wasm_call_ctors = wasmExports['se'])()

    var _main = (Module['_main'] = (a0, a1) =>
      (_main = Module['_main'] = wasmExports['te'])(a0, a1))

    var _ma_device__on_notification_unlocked = (Module['_ma_device__on_notification_unlocked'] = (
      a0
    ) =>
      (_ma_device__on_notification_unlocked = Module['_ma_device__on_notification_unlocked'] =
        wasmExports['ue'])(a0))

    var _ma_malloc_emscripten = (Module['_ma_malloc_emscripten'] = (a0, a1) =>
      (_ma_malloc_emscripten = Module['_ma_malloc_emscripten'] = wasmExports['ve'])(a0, a1))

    var _ma_free_emscripten = (Module['_ma_free_emscripten'] = (a0, a1) =>
      (_ma_free_emscripten = Module['_ma_free_emscripten'] = wasmExports['we'])(a0, a1))

    var _ma_device_process_pcm_frames_capture__webaudio = (Module[
      '_ma_device_process_pcm_frames_capture__webaudio'
    ] = (a0, a1, a2) =>
      (_ma_device_process_pcm_frames_capture__webaudio = Module[
        '_ma_device_process_pcm_frames_capture__webaudio'
      ] =
        wasmExports['xe'])(a0, a1, a2))

    var _ma_device_process_pcm_frames_playback__webaudio = (Module[
      '_ma_device_process_pcm_frames_playback__webaudio'
    ] = (a0, a1, a2) =>
      (_ma_device_process_pcm_frames_playback__webaudio = Module[
        '_ma_device_process_pcm_frames_playback__webaudio'
      ] =
        wasmExports['ye'])(a0, a1, a2))

    var __emscripten_tls_init = () => (__emscripten_tls_init = wasmExports['ze'])()

    var _pthread_self = () => (_pthread_self = wasmExports['Ae'])()

    var __emscripten_run_callback_on_thread = (a0, a1, a2, a3, a4) =>
      (__emscripten_run_callback_on_thread = wasmExports['Be'])(a0, a1, a2, a3, a4)

    var ___funcs_on_exit = () => (___funcs_on_exit = wasmExports['Ce'])()

    var __emscripten_thread_init = (a0, a1, a2, a3, a4, a5) =>
      (__emscripten_thread_init = wasmExports['De'])(a0, a1, a2, a3, a4, a5)

    var __emscripten_thread_crashed = () => (__emscripten_thread_crashed = wasmExports['Ee'])()

    var _fflush = (a0) => (_fflush = wasmExports['Fe'])(a0)

    var __emscripten_run_on_main_thread_js = (a0, a1, a2, a3, a4) =>
      (__emscripten_run_on_main_thread_js = wasmExports['Ge'])(a0, a1, a2, a3, a4)

    var __emscripten_thread_free_data = (a0) =>
      (__emscripten_thread_free_data = wasmExports['He'])(a0)

    var __emscripten_thread_exit = (a0) => (__emscripten_thread_exit = wasmExports['Ie'])(a0)

    var __emscripten_check_mailbox = () => (__emscripten_check_mailbox = wasmExports['Ke'])()

    var _malloc = (a0) => (_malloc = wasmExports['Le'])(a0)

    var _free = (a0) => (_free = wasmExports['Me'])(a0)

    var _emscripten_stack_set_limits = (a0, a1) =>
      (_emscripten_stack_set_limits = wasmExports['Ne'])(a0, a1)

    var __emscripten_stack_restore = (a0) => (__emscripten_stack_restore = wasmExports['Oe'])(a0)

    var __emscripten_stack_alloc = (a0) => (__emscripten_stack_alloc = wasmExports['Pe'])(a0)

    var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports['Qe'])()

    var dynCall_vi = (Module['dynCall_vi'] = (a0, a1) =>
      (dynCall_vi = Module['dynCall_vi'] = wasmExports['Re'])(a0, a1))

    var dynCall_vii = (Module['dynCall_vii'] = (a0, a1, a2) =>
      (dynCall_vii = Module['dynCall_vii'] = wasmExports['Se'])(a0, a1, a2))

    var dynCall_ii = (Module['dynCall_ii'] = (a0, a1) =>
      (dynCall_ii = Module['dynCall_ii'] = wasmExports['Te'])(a0, a1))

    var dynCall_iiii = (Module['dynCall_iiii'] = (a0, a1, a2, a3) =>
      (dynCall_iiii = Module['dynCall_iiii'] = wasmExports['Ue'])(a0, a1, a2, a3))

    var dynCall_viii = (Module['dynCall_viii'] = (a0, a1, a2, a3) =>
      (dynCall_viii = Module['dynCall_viii'] = wasmExports['Ve'])(a0, a1, a2, a3))

    var dynCall_viiii = (Module['dynCall_viiii'] = (a0, a1, a2, a3, a4) =>
      (dynCall_viiii = Module['dynCall_viiii'] = wasmExports['We'])(a0, a1, a2, a3, a4))

    var dynCall_viiiii = (Module['dynCall_viiiii'] = (a0, a1, a2, a3, a4, a5) =>
      (dynCall_viiiii = Module['dynCall_viiiii'] = wasmExports['Xe'])(a0, a1, a2, a3, a4, a5))

    var dynCall_viff = (Module['dynCall_viff'] = (a0, a1, a2, a3) =>
      (dynCall_viff = Module['dynCall_viff'] = wasmExports['Ye'])(a0, a1, a2, a3))

    var dynCall_vidd = (Module['dynCall_vidd'] = (a0, a1, a2, a3) =>
      (dynCall_vidd = Module['dynCall_vidd'] = wasmExports['Ze'])(a0, a1, a2, a3))

    var _asyncify_start_unwind = (a0) => (_asyncify_start_unwind = wasmExports['_e'])(a0)

    var _asyncify_stop_unwind = () => (_asyncify_stop_unwind = wasmExports['$e'])()

    var _asyncify_start_rewind = (a0) => (_asyncify_start_rewind = wasmExports['af'])(a0)

    var _asyncify_stop_rewind = () => (_asyncify_stop_rewind = wasmExports['bf'])()

    var ___emscripten_embedded_file_data = (Module['___emscripten_embedded_file_data'] = 216884)

    // include: postamble.js
    // === Auto-generated postamble setup entry stuff ===
    Module['addRunDependency'] = addRunDependency

    Module['removeRunDependency'] = removeRunDependency

    Module['FS_createPreloadedFile'] = FS_createPreloadedFile

    Module['FS_unlink'] = FS_unlink

    Module['FS_createPath'] = FS_createPath

    Module['FS_createDevice'] = FS_createDevice

    Module['FS_createDataFile'] = FS_createDataFile

    Module['FS_createLazyFile'] = FS_createLazyFile

    var calledRun

    dependenciesFulfilled = function runCaller() {
      // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
      if (!calledRun) run()
      if (!calledRun) dependenciesFulfilled = runCaller
    }

    // try this again later, after new deps are fulfilled
    function callMain(args = []) {
      var entryFunction = _main
      args.unshift(thisProgram)
      var argc = args.length
      var argv = stackAlloc((argc + 1) * 4)
      var argv_ptr = argv
      args.forEach((arg) => {
        GROWABLE_HEAP_U32()[argv_ptr >> 2] = stringToUTF8OnStack(arg)
        argv_ptr += 4
      })
      GROWABLE_HEAP_U32()[argv_ptr >> 2] = 0
      try {
        var ret = entryFunction(argc, argv)
        // if we're not running an evented main loop, it's time to exit
        exitJS(ret, /* implicit = */ true)
        return ret
      } catch (e) {
        return handleException(e)
      }
    }

    function run(args = arguments_) {
      if (runDependencies > 0) {
        return
      }
      if (ENVIRONMENT_IS_PTHREAD) {
        // The promise resolve function typically gets called as part of the execution
        // of `doRun` below. The workers/pthreads don't execute `doRun` so the
        // creation promise can be resolved, marking the pthread-Module as initialized.
        readyPromiseResolve(Module)
        initRuntime()
        startWorker(Module)
        return
      }
      preRun()
      // a preRun added a dependency, run will be called later
      if (runDependencies > 0) {
        return
      }
      function doRun() {
        // run may have just been called through dependencies being fulfilled just in this very frame,
        // or while the async setStatus time below was happening
        if (calledRun) return
        calledRun = true
        Module['calledRun'] = true
        if (ABORT) return
        initRuntime()
        preMain()
        readyPromiseResolve(Module)
        Module['onRuntimeInitialized']?.()
        if (shouldRunNow) callMain(args)
        postRun()
      }
      if (Module['setStatus']) {
        Module['setStatus']('Running...')
        setTimeout(function () {
          setTimeout(function () {
            Module['setStatus']('')
          }, 1)
          doRun()
        }, 1)
      } else {
        doRun()
      }
    }

    if (Module['preInit']) {
      if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']]
      while (Module['preInit'].length > 0) {
        Module['preInit'].pop()()
      }
    }

    // shouldRunNow refers to calling main(), not run().
    var shouldRunNow = true

    if (Module['noInitialRun']) shouldRunNow = false

    run()

    // end include: postamble.js
    // include: postamble_modularize.js
    // In MODULARIZE mode we wrap the generated code in a factory function
    // and return either the Module itself, or a promise of the module.
    // We assign to the `moduleRtn` global here and configure closure to see
    // this as and extern so it won't get minified.
    moduleRtn = readyPromise

    return moduleRtn
  }
})()
export default zigfish
var isPthread = globalThis.self?.name === 'em-pthread'
// When running as a pthread, construct a new instance on startup
isPthread && zigfish()
