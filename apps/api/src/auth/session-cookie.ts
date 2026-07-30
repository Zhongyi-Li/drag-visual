const cookieName = "zhbi_session";

const shouldUseSecureCookie = (): boolean => {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
};

const secureAttribute = (): string => shouldUseSecureCookie() ? "; Secure" : "";

export const readSessionCookie = (header: string | undefined): string | undefined => {
  if (!header) return undefined;
  const entry = header.split(";").find((value) => value.trim().startsWith(`${cookieName}=`));
  if (!entry) return undefined;
  const value = entry.trim().slice(cookieName.length + 1);
  return value || undefined;
};

export const sessionCookie = (token: string, expiresAt: Date): string => {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return `${cookieName}=${token}; Max-Age=${maxAge}; Expires=${expiresAt.toUTCString()}; Path=/; HttpOnly; SameSite=Lax${secureAttribute()}`;
};

export const clearedSessionCookie = (): string =>
  `${cookieName}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax${secureAttribute()}`;
