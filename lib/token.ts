import { createHash, randomBytes } from 'crypto';
export const newToken = () => randomBytes(32).toString('hex');
export const hashToken = (token:string) => createHash('sha256').update(token).digest('hex');
export const validToken = (token:unknown):token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
