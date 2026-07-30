import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { AuthService, type AuthenticatedUser } from "./auth.service.js";
import { readSessionCookie } from "./session-cookie.js";

export interface AuthenticatedFastifyRequest extends FastifyRequest {
  authUser?: AuthenticatedUser;
  sessionToken?: string;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    const sessionToken = readSessionCookie(request.headers.cookie);
    const user = await this.auth.authenticate(sessionToken);
    if (!user) {
      throw new UnauthorizedException({
        code: "AUTH_SESSION_INVALID",
        message: "登录状态已失效，请重新登录",
      });
    }
    request.authUser = user;
    if (sessionToken) request.sessionToken = sessionToken;
    return true;
  }
}
