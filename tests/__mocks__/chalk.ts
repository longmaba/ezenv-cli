// Mock for chalk to avoid ESM import issues in tests
const chalk = {
  // Support chaining for colored text
  red: Object.assign((text: string) => text, {
    bold: (text: string) => text,
  }),
  green: (text: string) => text,
  yellow: Object.assign((text: string) => text, {
    bold: (text: string) => text,
  }),
  blue: Object.assign((text: string) => text, {
    underline: (text: string) => text,
  }),
  cyan: (text: string) => text,
  gray: (text: string) => text,
  grey: (text: string) => text,
  white: (text: string) => text,
  bold: (text: string) => text,
  underline: (text: string) => text,
  redBright: (text: string) => text,
  greenBright: (text: string) => text,
  yellowBright: (text: string) => text,
  blueBright: (text: string) => text,
  cyanBright: (text: string) => text,
};

export default chalk;