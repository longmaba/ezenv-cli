// Mock for ora spinner
const oraMock = {
  start: jest.fn().mockReturnThis(),
  stop: jest.fn().mockReturnThis(),
  succeed: jest.fn().mockReturnThis(),
  fail: jest.fn().mockReturnThis(),
  text: ''
};

export default jest.fn(() => oraMock);