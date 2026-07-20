import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export interface AuthenticatedUser {
  id: string;
  username: string;
}

export interface AuthenticationResult {
  accessToken: string;
  user: AuthenticatedUser;
}

const invalidCredentials = (): UnauthorizedException => new UnauthorizedException({
  code: "AUTH_INVALID_CREDENTIALS",
  message: "账号或密码不正确",
});

const normalizeUsername = (username: string): string => username.trim().toLocaleLowerCase();

const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
};

const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, expectedKey] = storedHash.split(":");
  if (!salt || !expectedKey) return false;
  const derivedKey = await scrypt(password, salt, keyLength) as Buffer;
  const expectedBuffer = Buffer.from(expectedKey, "hex");
  return expectedBuffer.length === derivedKey.length && timingSafeEqual(expectedBuffer, derivedKey);
};

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(username: string, password: string): Promise<AuthenticationResult> {
    const normalizedUsername = normalizeUsername(username);
    const existing = await this.prisma.userRecord.findUnique({ where: { username: normalizedUsername } });
    if (existing) {
      throw new ConflictException({
        code: "AUTH_USERNAME_TAKEN",
        message: "该账号已被注册，请直接登录",
      });
    }

    const user = await this.prisma.userRecord.create({
      data: { username: normalizedUsername, passwordHash: await hashPassword(password) },
      select: { id: true, username: true },
    });
    return this.createResult(user);
  }

  async login(username: string, password: string): Promise<AuthenticationResult> {
    const user = await this.prisma.userRecord.findUnique({ where: { username: normalizeUsername(username) } });
    if (!user || !await verifyPassword(password, user.passwordHash)) throw invalidCredentials();
    return this.createResult(user);
  }

  private createResult(user: AuthenticatedUser): AuthenticationResult {
    return {
      accessToken: randomBytes(32).toString("base64url"),
      user,
    };
  }
}
