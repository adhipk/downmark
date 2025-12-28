/**
 * Passkey authentication using WebAuthn
 */

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server/script/deps';

// In-memory storage (replace with database in production)
interface User {
  id: string;
  username: string;
  credentials: Authenticator[];
}

interface Authenticator {
  credentialID: string;
  credentialPublicKey: Uint8Array;
  counter: number;
  transports?: string[];
}

interface Session {
  userId: string;
  expiresAt: number;
}

const users = new Map<string, User>();
const sessions = new Map<string, Session>();
const challenges = new Map<string, string>();

// Configuration
const RP_NAME = process.env.RP_NAME || 'HTML to Markdown Converter';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

export function getUser(username: string): User | undefined {
  return users.get(username);
}

export function getUserById(userId: string): User | undefined {
  for (const user of users.values()) {
    if (user.id === userId) return user;
  }
  return undefined;
}

export function createUser(username: string): User {
  const user: User = {
    id: crypto.randomUUID(),
    username,
    credentials: [],
  };
  users.set(username, user);
  return user;
}

export function addCredential(username: string, credential: Authenticator) {
  const user = users.get(username);
  if (!user) throw new Error('User not found');
  user.credentials.push(credential);
}

export function getCredential(credentialID: string): { user: User; credential: Authenticator } | undefined {
  for (const user of users.values()) {
    const credential = user.credentials.find(c => c.credentialID === credentialID);
    if (credential) return { user, credential };
  }
  return undefined;
}

export function updateCredentialCounter(credentialID: string, newCounter: number) {
  const result = getCredential(credentialID);
  if (result) {
    result.credential.counter = newCounter;
  }
}

// Session management
export function createSession(userId: string): string {
  const sessionId = crypto.randomUUID();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  sessions.set(sessionId, { userId, expiresAt });
  return sessionId;
}

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;

  // Check if expired
  if (session.expiresAt < Date.now()) {
    sessions.delete(sessionId);
    return undefined;
  }

  return session;
}

export function deleteSession(sessionId: string) {
  sessions.delete(sessionId);
}

// Challenge management
export function storeChallenge(username: string, challenge: string) {
  challenges.set(username, challenge);
}

export function getChallenge(username: string): string | undefined {
  const challenge = challenges.get(username);
  challenges.delete(username); // Use once
  return challenge;
}

// WebAuthn registration
export async function startRegistration(username: string) {
  let user = getUser(username);
  if (!user) {
    user = createUser(username);
  }

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: username,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  storeChallenge(username, options.challenge);
  return options;
}

export async function finishRegistration(username: string, response: RegistrationResponseJSON) {
  const user = getUser(username);
  if (!user) throw new Error('User not found');

  const expectedChallenge = getChallenge(username);
  if (!expectedChallenge) throw new Error('Challenge not found');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Registration verification failed');
  }

  const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

  const newCredential: Authenticator = {
    credentialID: Buffer.from(credentialID).toString('base64'),
    credentialPublicKey: new Uint8Array(credentialPublicKey),
    counter,
    transports: response.response.transports,
  };

  addCredential(username, newCredential);
  return user;
}

// WebAuthn authentication
export async function startAuthentication(username: string) {
  const user = getUser(username);
  if (!user || user.credentials.length === 0) {
    throw new Error('User not found or no credentials registered');
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: user.credentials.map(cred => ({
      id: Buffer.from(cred.credentialID, 'base64'),
      transports: cred.transports as any,
    })),
    userVerification: 'preferred',
  });

  storeChallenge(username, options.challenge);
  return options;
}

export async function finishAuthentication(username: string, response: AuthenticationResponseJSON) {
  const user = getUser(username);
  if (!user) throw new Error('User not found');

  const expectedChallenge = getChallenge(username);
  if (!expectedChallenge) throw new Error('Challenge not found');

  const credentialID = Buffer.from(response.id, 'base64url').toString('base64');
  const result = getCredential(credentialID);
  if (!result) throw new Error('Credential not found');

  const { credential } = result;

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: Buffer.from(credential.credentialID, 'base64'),
      publicKey: credential.credentialPublicKey,
      counter: credential.counter,
    },
  });

  if (!verification.verified) {
    throw new Error('Authentication verification failed');
  }

  updateCredentialCounter(credentialID, verification.authenticationInfo.newCounter);
  return user;
}
