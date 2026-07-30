import {
  argon2 as argon2Callback,
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";

import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

const argon2 = promisify(argon2Callback);
const scrypt = promisify(scryptCallback);
const keyLength = 64;
const sessionTokenBytes = 32;
const rememberedSessionMs = 7 * 24 * 60 * 60 * 1000;
const temporarySessionMs = 24 * 60 * 60 * 1000;

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface UserPreference {
  themeMode: string;
  locale: string;
  timezone: string;
  dashboardListView: string;
}

export interface AuthenticationResult {
  sessionToken: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export interface SessionSummary {
  id: string;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  current: boolean;
}

const invalidCredentials = (): UnauthorizedException => new UnauthorizedException({
  code: "AUTH_INVALID_CREDENTIALS",
  message: "账号或密码不正确",
});

const normalizeUsername = (username: string): string => username.trim().toLocaleLowerCase();
const hashSessionToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const hashPassword = async (password: string): Promise<string> => {
  const nonce = randomBytes(16);
  const derivedKey = await argon2("argon2id", {
    message: Buffer.from(password),
    nonce,
    parallelism: 1,
    tagLength: keyLength,
    memory: 19_456,
    passes: 2,
  });
  return `argon2id:${nonce.toString("base64url")}:${derivedKey.toString("base64url")}`;
};

const verifyLegacyScryptPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, expectedKey] = storedHash.split(":");
  if (!salt || !expectedKey) return false;
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer;
  const expectedBuffer = Buffer.from(expectedKey, "hex");
  return expectedBuffer.length === derivedKey.length && timingSafeEqual(expectedBuffer, derivedKey);
};

const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (!storedHash.startsWith("argon2id:")) return verifyLegacyScryptPassword(password, storedHash);
  const [, nonceValue, expectedValue] = storedHash.split(":");
  if (!nonceValue || !expectedValue) return false;
  const expected = Buffer.from(expectedValue, "base64url");
  const derived = await argon2("argon2id", {
    message: Buffer.from(password),
    nonce: Buffer.from(nonceValue, "base64url"),
    parallelism: 1,
    tagLength: expected.length,
    memory: 19_456,
    passes: 2,
  });
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};

const toAuthenticatedUser = (user: {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}): AuthenticatedUser => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
});

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(username: string, password: string, remember: boolean, userAgent?: string): Promise<AuthenticationResult> {
    const normalizedUsername = normalizeUsername(username);
    const existing = await this.prisma.userRecord.findUnique({ where: { username: normalizedUsername } });
    if (existing) {
      throw new ConflictException({
        code: "AUTH_USERNAME_TAKEN",
        message: "该账号已被注册，请直接登录",
      });
    }

    const user = await this.prisma.userRecord.create({
      data: {
        username: normalizedUsername,
        displayName: username.trim(),
        passwordHash: await hashPassword(password),
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    return this.createSession(user, remember, userAgent);
  }

  async login(username: string, password: string, remember: boolean, userAgent?: string): Promise<AuthenticationResult> {
    const user = await this.prisma.userRecord.findUnique({
      where: { username: normalizeUsername(username) },
      select: { id: true, username: true, passwordHash: true, displayName: true, avatarUrl: true },
    });
    if (!user || !await verifyPassword(password, user.passwordHash)) throw invalidCredentials();

    if (!user.passwordHash.startsWith("argon2id:")) {
      await this.prisma.userRecord.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
    }
    await this.prisma.userRecord.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.createSession(user, remember, userAgent);
  }

  async authenticate(sessionToken: string | undefined): Promise<AuthenticatedUser | null> {
    if (!sessionToken) return null;
    const session = await this.prisma.sessionRecord.findFirst({
      where: { tokenHash: hashSessionToken(sessionToken), revokedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!session) return null;
    await this.prisma.sessionRecord.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    return toAuthenticatedUser(session.user);
  }

  async getPreference(userId: string): Promise<UserPreference> {
    const preference = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return preference;
  }

  async updateProfile(userId: string, values: {
    displayName?: string | undefined;
    avatarUrl?: string | null | undefined;
    preference?: {
      themeMode?: string | undefined;
      locale?: string | undefined;
      timezone?: string | undefined;
      dashboardListView?: string | undefined;
    } | undefined;
  }): Promise<AuthenticatedUser> {
    const user = await this.prisma.userRecord.update({
      where: { id: userId },
      data: {
        ...(values.displayName === undefined ? {} : { displayName: values.displayName }),
        ...(values.avatarUrl === undefined ? {} : { avatarUrl: values.avatarUrl }),
      },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });
    if (values.preference) {
      const preference = {
        ...(values.preference.themeMode === undefined ? {} : { themeMode: values.preference.themeMode }),
        ...(values.preference.locale === undefined ? {} : { locale: values.preference.locale }),
        ...(values.preference.timezone === undefined ? {} : { timezone: values.preference.timezone }),
        ...(values.preference.dashboardListView === undefined ? {} : { dashboardListView: values.preference.dashboardListView }),
      };
      await this.prisma.userPreference.upsert({
        where: { userId },
        create: { userId, ...preference },
        update: preference,
      });
    }
    return toAuthenticatedUser(user);
  }

  async listSessions(userId: string, currentToken: string | undefined): Promise<SessionSummary[]> {
    const currentHash = currentToken ? hashSessionToken(currentToken) : "";
    const sessions = await this.prisma.sessionRecord.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
    });
    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
      current: session.tokenHash === currentHash,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await this.prisma.sessionRecord.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count === 1;
  }

  async revokeCurrentSession(sessionToken: string | undefined): Promise<void> {
    if (!sessionToken) return;
    await this.prisma.sessionRecord.updateMany({
      where: { tokenHash: hashSessionToken(sessionToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string, exceptToken?: string): Promise<void> {
    const exceptHash = exceptToken ? hashSessionToken(exceptToken) : undefined;
    await this.prisma.sessionRecord.updateMany({
      where: { userId, revokedAt: null, ...(exceptHash ? { tokenHash: { not: exceptHash } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, currentPassword: string, nextPassword: string, currentToken?: string): Promise<void> {
    const user = await this.prisma.userRecord.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !await verifyPassword(currentPassword, user.passwordHash)) throw invalidCredentials();
    await this.prisma.userRecord.update({ where: { id: userId }, data: { passwordHash: await hashPassword(nextPassword) } });
    await this.revokeAllSessions(userId, currentToken);
  }

  private async createSession(user: AuthenticatedUser, remember: boolean, userAgent?: string): Promise<AuthenticationResult> {
    const sessionToken = randomBytes(sessionTokenBytes).toString("base64url");
    const expiresAt = new Date(Date.now() + (remember ? rememberedSessionMs : temporarySessionMs));
    await this.prisma.sessionRecord.create({
      data: {
        userId: user.id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt,
        ...(userAgent ? { userAgent: userAgent.slice(0, 500) } : {}),
      },
    });
    return { sessionToken, expiresAt, user };
  }
}
