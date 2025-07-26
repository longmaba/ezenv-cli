// Mock node-fetch with proper response simulation
type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text?: () => Promise<string>;
  headers?: any;
};

// Store mock implementations
const mockImplementations = new Map<string, (url: string, options?: any) => Promise<MockResponse>>();

// Create the mock fetch function
const mockFetch = jest.fn(async (url: string, options?: any): Promise<any> => {
  // Check for mock implementations
  for (const [pattern, impl] of mockImplementations) {
    if (url.includes(pattern)) {
      const response = await impl(url, options);
      return {
        ok: response.ok,
        status: response.status,
        json: response.json,
        text: response.text || (async () => JSON.stringify(await response.json())),
        headers: response.headers || new Map(),
      };
    }
  }
  
  // Default error if no mock found
  const error = new Error(`fetch failed`);
  (error as any).code = 'ENOTFOUND';
  (error as any).cause = { code: 'ENOTFOUND' };
  throw error;
});

// Helper to set mock implementations
export const setMockResponse = (urlPattern: string, response: MockResponse | ((url: string, options?: any) => Promise<MockResponse>)) => {
  if (typeof response === 'function') {
    mockImplementations.set(urlPattern, response);
  } else {
    mockImplementations.set(urlPattern, async () => response);
  }
};

// Helper to clear all mocks
export const clearAllMocks = () => {
  mockImplementations.clear();
  mockFetch.mockClear();
};

export default mockFetch;
export { mockFetch as fetch };