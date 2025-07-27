// Mock keytar - by default falls back to memory storage
// Individual tests can override this behavior
const keytarError = new Error('Keytar is not available');

const keytar = {
  setPassword: jest.fn().mockRejectedValue(keytarError),
  getPassword: jest.fn().mockRejectedValue(keytarError),
  deletePassword: jest.fn().mockRejectedValue(keytarError),
  findPassword: jest.fn().mockRejectedValue(keytarError),
  findCredentials: jest.fn().mockRejectedValue(keytarError),
};

export default keytar;