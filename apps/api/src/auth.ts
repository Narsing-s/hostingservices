import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createSession, deleteSession, getUserByEmail, getUserBySession, upsertOAuthAccount } from './db.js';
export type PublicUser={id:string;email?:string|null;name:string;avatarUrl?:string|null;createdAt:string};
const SESSION_DAYS=30;
const authKey=()=>createHash('sha256').update(process.env.AUTH_SECRET??'nexus-dev-auth-secret-change-me').digest();
export function encryptToken(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',authKey(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;}
export function decryptToken(value:string){const [ivRaw,tagRaw,dataRaw]=value.split('.');if(!ivRaw||!tagRaw||!dataRaw)throw new Error('Invalid encrypted OAuth token');const decipher=createDecipheriv('aes-256-gcm',authKey(),Buffer.from(ivRaw,'base64url'));decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8');}
export function hashPassword(password:string){const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');return `${salt}:${hash}`;}
export function verifyPassword(password:string,stored:string){const [salt,hex]=stored.split(':');if(!salt||!hex)return false;const actual=scryptSync(password,salt,64);const expected=Buffer.from(hex,'hex');return actual.length===expected.length&&timingSafeEqual(actual,expected);}
export function newSessionToken(){return randomBytes(32).toString('base64url');}
export function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}
export async function startSession(userId:string){const token=newSessionToken();const expires=new Date(Date.now()+SESSION_DAYS*86400000).toISOString();await createSession(userId,tokenHash(token),expires);return {token,expires};}
export async function userFromToken(token:string|undefined){if(!token)return undefined;return getUserBySession(tokenHash(token)) as Promise<PublicUser|undefined>;}
export async function endSession(token:string|undefined){if(token)await deleteSession(tokenHash(token));}
export async function findEmailUser(email:string){return getUserByEmail(email);}
export { upsertOAuthAccount };
