import type { onSendHookHandler, FastifyServerOptions } from "fastify";

const DASHBOARD_SCHEMA_INVALID = JSON.stringify({
  code: "DASHBOARD_SCHEMA_INVALID",
  message: "Dashboard schema is invalid",
});

export const safeJsonFastifyOptions = {
  bodyLimit: 2 * 1024 * 1024,
  // Preserve legal JSON keys; schema-parse every body immediately and never merge/assign raw request objects.
  onProtoPoisoning: "ignore",
  onConstructorPoisoning: "ignore",
} as const satisfies FastifyServerOptions;

export const dashboardErrorEnvelopeHook: onSendHookHandler = (
  request,
  reply,
  payload,
  done,
) => {
  if (
    /^\/dashboards(?:\/|$)/.test(request.url.split("?", 1)[0] ?? "") &&
    (reply.statusCode === 400 || reply.statusCode === 413)
  ) {
    reply.code(400).type("application/json; charset=utf-8");
    done(null, DASHBOARD_SCHEMA_INVALID);
    return;
  }
  done(null, payload);
};
