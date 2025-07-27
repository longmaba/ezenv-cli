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

// Helper to create error response with both json and text methods
export const createErrorResponse = (status: number, error: any): MockResponse => {
  const errorData = typeof error === 'string' ? { error } : error;
  return {
    ok: false,
    status,
    json: async () => errorData,
    text: async () => JSON.stringify(errorData)
  };
};

// Helper to create success response
export const createSuccessResponse = (data: any): MockResponse => {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
};

export default mockFetch;
export { mockFetch as fetch };