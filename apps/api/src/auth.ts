import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createSession, deleteSession, getUserByEmail, getUserBySession, upsertOAuthAccount } from './db.js';

export type PublicUser = { id:string; email?:string|null; name:string; avatarUrl?:string|null; createdAt:string };
const SESSION_DAYS = 30;

export function hashPassword(password:string) {
  const salt=randomBytes(16).toString('hex');
  const hash=scryptSync(password,salt,64).toString('hex');
  return `${salt}:${hash}`;
}
export function verifyPassword(password:string, stored:string) {
  const [salt,hex]=stored.split(':');
  if(!salt||!hex) return false;
  const actual=scryptSync(password,salt,64);
  const expected=Buffer.from(hex,'hex');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export function newSessionToken(){return randomBytes(32).toString('base64url');}
export function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
export async function startSession(userId:string){const token=newSessionToken();const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await createSession(userId,tokenHash(token),expires);return {token,expires};}
export async function userFromToken(token:string|undefined){if(!token)return undefined;return getUserBySession(tokenHash(token)) as Promise<PublicUser|undefined>;}
export async function endSession(token:string|undefined){if(token)await deleteSession(tokenHash(token));}
export async function findEmailUser(email:string){return getUserByEmail(email);}
export { upsertOAuthAccount };
