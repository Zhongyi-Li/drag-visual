import { BadRequestException, Body, Controller, Inject, Post } from "@nestjs/common";
import { z, ZodError } from "zod";

import { AuthService } from "./auth.service.js";

const UsernameBody = z.object({
  username: z.string().trim().min(4).max(40),
}).strict();

const LoginCredentialsBody = UsernameBody.extend({
  password: z.string().min(8).max(128),
}).strict();

const RegisterCredentialsBody = UsernameBody.extend({
  password: z.string()
    .min(8)
    .max(128)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/),
}).strict();

const parseCredentials = (body: unknown, schema: typeof LoginCredentialsBody | typeof RegisterCredentialsBody) => {
  try {
    return schema.parse(body);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new BadRequestException({
        code: "AUTH_INPUT_INVALID",
        message: "账号或密码格式不正确",
      });
    }
    throw error;
  }
};

@Controller("api/auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post("register")
  async register(@Body() body: unknown) {
    const credentials = parseCredentials(body, RegisterCredentialsBody);
    return this.auth.register(credentials.username, credentials.password);
  }

  @Post("login")
  async login(@Body() body: unknown) {
    const credentials = parseCredentials(body, LoginCredentialsBody);
    return this.auth.login(credentials.username, credentials.password);
  }
}
