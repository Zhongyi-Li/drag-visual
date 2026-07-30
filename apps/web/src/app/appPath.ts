/**
 * Builds a browser URL inside the application base path.
 *
 * Vite serves the app from `/` during local development and from `/ZHBI/` in
 * the Windows IIS deployment. Browser navigation that bypasses React Router
 * (for example `window.open` and antd's `href`) must use this helper too.
 */
export const appPath = (path = ""): string => {
  const baseSegment = import.meta.env.BASE_URL.replace(/^\/+|\/+$/g, "");
  const base = baseSegment ? `/${baseSegment}` : "";
  const suffix = path.replace(/^\/+/, "");

  if (suffix) return `${base}/${suffix}`;
  return base ? `${base}/` : "/";
};
