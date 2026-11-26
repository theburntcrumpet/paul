import { TextDecoder, TextEncoder } from 'node:util'
import JSDOMEnvironment from 'jest-environment-jsdom'

/**
 * jsdom plus the Web platform APIs that jsdom does not provide but browsers (and react-router)
 * rely on: encoding and the Fetch API classes. AbortController/AbortSignal are swapped for Node's
 * so that signals passed to Node's `Request` are accepted.
 */
export default class PaulEnvironment extends JSDOMEnvironment {
  async setup() {
    await super.setup()
    const g = this.global
    g.TextEncoder ??= TextEncoder
    g.TextDecoder ??= TextDecoder
    for (const name of ['Request', 'Response', 'Headers', 'ReadableStream', 'structuredClone']) {
      g[name] ??= globalThis[name]
    }
    g.AbortController = globalThis.AbortController
    g.AbortSignal = globalThis.AbortSignal
  }
}
