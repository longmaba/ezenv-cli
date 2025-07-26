// Mock keytar to throw an error so credential service falls back to memory storage
const keytarError = new Error('Keytar is not available');

export default {
  setPassword: jest.fn().mockRejectedValue(keytarError),
  getPassword: jest.fn().mockRejectedValue(keytarError),
  deletePassword: jest.fn().mockRejectedValue(keytarError),
  findPassword: jest.fn().mockRejectedValue(keytarError),
  findCredentials: jest.fn().mockRejectedValue(keytarError),
};