// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { readAuthSession, saveAuthSession } from "./authSession.js";
import { AccountSettingsModal } from "./AccountSettingsModal.js";

const user = { id: "test-user", username: "hello_user", displayName: "原名称", avatarUrl: null };

const renderModal = () => render(<AppProviders><AccountSettingsModal open onClose={() => undefined} /></AppProviders>);

describe("AccountSettingsModal", () => {
  it("confirms a profile save and synchronizes the session user", async () => {
    server.use(
      http.get("http://localhost/api/auth/me", () => HttpResponse.json({ user })),
      http.patch("http://localhost/api/auth/me", async ({ request }) => {
        expect(await request.json()).toEqual({ displayName: "新名称", avatarUrl: null });
        return HttpResponse.json({ user: { ...user, displayName: "新名称" } });
      }),
    );
    saveAuthSession({ user });
    renderModal();

    const displayName = await screen.findByDisplayValue("原名称");
    await userEvent.clear(displayName);
    await userEvent.type(displayName, "新名称");
    await userEvent.click(screen.getByRole("button", { name: "保存资料" }));

    expect(await screen.findByText("个人资料已保存")).toBeInTheDocument();
    await waitFor(() => expect(readAuthSession()?.user.displayName).toBe("新名称"));
  });

  it("confirms a password change and clears the password fields", async () => {
    server.use(
      http.get("http://localhost/api/auth/me", () => HttpResponse.json({ user })),
      http.get("http://localhost/api/auth/sessions", () => HttpResponse.json([])),
      http.patch("http://localhost/api/auth/me/password", async ({ request }) => {
        expect(await request.json()).toEqual({ currentPassword: "Old1!pass", nextPassword: "New1!pass" });
        return HttpResponse.json({ changed: true });
      }),
    );
    renderModal();

    await userEvent.click(await screen.findByText("安全设置"));
    const currentPassword = screen.getByPlaceholderText("当前密码");
    const nextPassword = screen.getByPlaceholderText("新密码（至少 8 位，含大小写、数字和符号）");
    await userEvent.type(currentPassword, "Old1!pass");
    await userEvent.type(nextPassword, "New1!pass");
    await userEvent.click(screen.getByRole("button", { name: "修改密码并下线其他设备" }));

    expect(await screen.findByText("密码已修改，其他设备已下线")).toBeInTheDocument();
    await waitFor(() => {
      expect(currentPassword).toHaveValue("");
      expect(nextPassword).toHaveValue("");
    });
  });
});
