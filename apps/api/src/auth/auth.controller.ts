import { BadRequestException, Body, Controller, Delete, Get, Inject, Param, Patch, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { z, ZodError } from "zod";

import { AuthService, type AuthenticatedUser } from "./auth.service.js";
import { CurrentUser } from "./current-user.decorator.js";
import { clearedSessionCookie, sessionCookie } from "./session-cookie.js";
import { SessionAuthGuard, type AuthenticatedFastifyRequest } from "./session-auth.guard.js";

const UsernameBody = z.object({
  username: z.string().trim().min(4).max(40),
}).strict();

const LoginCredentialsBody = UsernameBody.extend({
  password: z.string().min(8).max(128),
  remember: z.boolean().optional().default(false),
}).strict();

const RegisterCredentialsBody = UsernameBody.extend({
  password: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/),
  remember: z.boolean().optional().default(false),
}).strict();

const ProfileBody = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
  preference: z.object({
    themeMode: z.enum(["light", "dark", "system"]).optional(),
    locale: z.string().min(2).max(20).optional(),
    timezone: z.string().min(1).max(100).optional(),
    dashboardListView: z.enum(["grid", "list"]).optional(),
  }).strict().optional(),
}).strict();

const PasswordBody = z.object({
  currentPassword: z.string().min(8).max(128),
  nextPassword: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/),
}).strict();

const parseBody = <Result>(body: unknown, schema: z.ZodType<Result>): Result => {
  try {
    return schema.parse(body);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new BadRequestException({ code: "AUTH_INPUT_INVALID", message: "提交的信息格式不正确" });
    }
    throw error;
  }
};

const setSessionCookie = (reply: FastifyReply, token: string, expiresAt: Date): void => {
  reply.header("Set-Cookie", sessionCookie(token, expiresAt));
  reply.header("Cache-Control", "no-store");
};

const userAgent = (request: AuthenticatedFastifyRequest): string | undefined => {
  const value = request.headers["user-agent"];
  return typeof value === "string" ? value : undefined;
};

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: unknown, @Req() request: AuthenticatedFastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const credentials = parseBody(body, RegisterCredentialsBody);
    const result = await this.auth.register(credentials.username, credentials.password, credentials.remember, userAgent(request));
    setSessionCookie(reply, result.sessionToken, result.expiresAt);
    return { user: result.user };
  }

  @Post("login")
  async login(@Body() body: unknown, @Req() request: AuthenticatedFastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const credentials = parseBody(body, LoginCredentialsBody);
    const result = await this.auth.login(credentials.username, credentials.password, credentials.remember, userAgent(request));
    setSessionCookie(reply, result.sessionToken, result.expiresAt);
    return { user: result.user };
  }

  @UseGuards(SessionAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser, @Req() request: AuthenticatedFastifyRequest) {
    return { user, preference: await this.auth.getPreference(user.id), sessionActive: Boolean(request.sessionToken) };
  }

  @UseGuards(SessionAuthGuard)
  @Patch("me")
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const values = parseBody(body, ProfileBody);
    return { user: await this.auth.updateProfile(user.id, values), preference: await this.auth.getPreference(user.id) };
  }

  @UseGuards(SessionAuthGuard)
  @Patch("me/password")
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Req() request: AuthenticatedFastifyRequest, @Body() body: unknown) {
    const values = parseBody(body, PasswordBody);
    await this.auth.changePassword(user.id, values.currentPassword, values.nextPassword, request.sessionToken);
    return { changed: true };
  }

  @UseGuards(SessionAuthGuard)
  @Get("sessions")
  async sessions(@CurrentUser() user: AuthenticatedUser, @Req() request: AuthenticatedFastifyRequest) {
    return this.auth.listSessions(user.id, request.sessionToken);
  }

  @UseGuards(SessionAuthGuard)
  @Delete("sessions/:id")
  async revokeSession(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Req() request: AuthenticatedFastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const revoked = await this.auth.revokeSession(user.id, id);
    if (!revoked) throw new UnauthorizedException({ code: "AUTH_SESSION_NOT_FOUND", message: "登录设备不存在或已失效" });
    const sessions = await this.auth.listSessions(user.id, request.sessionToken);
    if (!sessions.some((session) => session.current)) reply.header("Set-Cookie", clearedSessionCookie());
    return { revoked: true };
  }

  @UseGuards(SessionAuthGuard)
  @Post("logout-all")
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() request: AuthenticatedFastifyRequest) {
    await this.auth.revokeAllSessions(user.id, request.sessionToken);
    return { revoked: true };
  }

  @UseGuards(SessionAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() _user: AuthenticatedUser, @Req() request: AuthenticatedFastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.revokeCurrentSession(request.sessionToken);
    reply.header("Set-Cookie", clearedSessionCookie());
    return { loggedOut: true };
  }
}
