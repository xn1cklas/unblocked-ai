// Using @better-auth/utils npm package for secure random ID generation
import { createRandomStringGenerator } from '@better-auth/utils/random';

export const generateId = (size?: number) => {
  return createRandomStringGenerator('a-z', 'A-Z', '0-9')(size || 32);
};
