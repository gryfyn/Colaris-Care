import '@testing-library/jest-dom'

// Mock fetch for component/unit tests (not integration tests with real server)
// Integration tests should run with TEST_BASE_URL set
const isIntegrationTest = process.env.TEST_BASE_URL || process.argv.some(arg => arg.includes('integration') || arg.includes('critical'))
if (!isIntegrationTest) {
  global.fetch = jest.fn()
}

// Polyfill for TextEncoder/TextDecoder needed by pg module in Node environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Mock Response for API route tests
if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.ok = this.status >= 200 && this.status < 300
    }

    static json(body, init = {}) {
      const jsonString = JSON.stringify(body)
      const response = new Response(jsonString, {
        ...init,
        status: init.status || 200,
        headers: { 'content-type': 'application/json', ...init.headers },
      })
      response._jsonBody = body
      return response
    }

    async json() {
      if (this._jsonBody !== undefined) {
        return this._jsonBody
      }
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }

    async text() {
      return this.body
    }
  }
}

// Mock Request for API route tests (jsdom does not provide the fetch Request)
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input?.url
      this.method = init.method || 'GET'
      this.headers = new Map(Object.entries(init.headers || {}))
      this._body = init.body
    }

    async json() {
      return typeof this._body === 'string' ? JSON.parse(this._body) : this._body
    }

    async text() {
      return typeof this._body === 'string' ? this._body : JSON.stringify(this._body)
    }
  }
}

// Mock Headers if not provided by the environment
if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers extends Map {
    get(key) { return super.get(String(key).toLowerCase()) }
    set(key, value) { return super.set(String(key).toLowerCase(), value) }
  }
}

// Polyfill ResizeObserver (used by responsive components, absent in jsdom)
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Default mock for next/navigation (jsdom has no Next.js router context).
// Individual tests can override with their own jest.mock() if needed.
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
})
