import crypto from "crypto";

export const generateCode = (prefix: string): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  const bytes = crypto.randomBytes(17);
  for (let i = 0; i < 17; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `${prefix}_${code}`;
};
