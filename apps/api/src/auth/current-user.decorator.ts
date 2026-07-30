import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthenticatedUser } from "./auth.service.js";
import type { AuthenticatedFastifyRequest } from "./session-auth.guard.js";

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    if (!request.authUser) throw new Error("Authenticated user was not attached to the request");
    return request.authUser;
  },
);
