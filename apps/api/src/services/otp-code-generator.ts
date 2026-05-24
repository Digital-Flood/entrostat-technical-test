import { randomInt } from 'node:crypto';

export function generateNumericOtpCode(length: number): string {
  let code = '';

  for (let index = 0; index < length; index += 1) {
    code += String(randomInt(10));
  }

  return code;
}
