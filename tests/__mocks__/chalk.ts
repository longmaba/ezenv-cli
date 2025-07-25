// Mock for chalk to avoid ESM import issues in tests
const chalk = {
  red: (text: string) => text,
  green: (text: string) => text,
  yellow: (text: string) => text,
  blue: (text: string) => text,
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
  
  // Support chaining
  red: Object.assign((text: string) => text, {
    bold: (text: string) => text,
  }),
  yellow: Object.assign((text: string) => text, {
    bold: (text: string) => text,
  }),
  blue: Object.assign((text: string) => text, {
    underline: (text: string) => text,
  }),
};

export default chalk;