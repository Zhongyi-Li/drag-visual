import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";

const request = { headers: {} } as never;
const reply = { header: vi.fn() } as never;

const createController = () => {
  const auth = {
    register: vi.fn(),
    login: vi.fn(),
  };
  return { controller: new AuthController(auth as unknown as AuthService), auth };
};

describe("AuthController registration password policy", () => {
  it.each([
    "lowercase1!",
    "UPPERCASE1!",
    "NoSymbol123",
    "NoNumber!Pass",
    "Short1!",
  ])("rejects a registration password missing a required character class: %s", async (password) => {
    const { controller, auth } = createController();

    await expect(controller.register({ username: "zhbi_user", password })).rejects.toBeInstanceOf(BadRequestException);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("accepts an eight-character password with upper/lowercase letters, a number and a symbol", async () => {
    const { controller, auth } = createController();
    auth.register.mockResolvedValue({ sessionToken: "token", expiresAt: new Date(Date.now() + 60_000), user: { id: "user-1", username: "zhbi_user", displayName: null, avatarUrl: null } });

    await expect(controller.register({ username: "zhbi_user", password: "Zhbi1!ab" }, request, reply)).resolves.toMatchObject({ user: { id: "user-1" } });
    expect(auth.register).toHaveBeenCalledWith("zhbi_user", "Zhbi1!ab", false, undefined);
  });

  it("accepts an account name with any character type when it has at least four characters", async () => {
    const { controller, auth } = createController();
    auth.register.mockResolvedValue({ sessionToken: "token", expiresAt: new Date(Date.now() + 60_000), user: { id: "user-1", username: "纵横@账号", displayName: null, avatarUrl: null } });

    await expect(controller.register({ username: "  纵横@账号  ", password: "Zhbi1!ab" }, request, reply)).resolves.toMatchObject({ user: { id: "user-1" } });
    expect(auth.register).toHaveBeenCalledWith("纵横@账号", "Zhbi1!ab", false, undefined);
  });
});
