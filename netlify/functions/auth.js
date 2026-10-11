const crypto = require("node:crypto");

const ACTIONS = new Set(["register", "login", "logout", "me"]);
const COOKIE_NAME = "gw_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const REQUEST_TIMEOUT_MS = 15000;

const jsonResponse = (statusCode, payload, cookie) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(cookie ? { "Set-Cookie": cookie } : {}),
  },
  body: JSON.stringify(payload),
});

const sessionCookie = (token) =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
const clearCookie = () =>
  `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }
  if (!(event.headers["content-type"] || "").includes("application/json")) {
    return jsonResponse(415, { error: "unsupported_media_type" });
  }

  const relayUrl = process.env.HERMES_RELAY_URL;
  const relaySecret = process.env.HERMES_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    console.error("Relay environment variables are not configured");
    return jsonResponse(503, { error: "auth_not_configured" });
  }

  let input;
  try {
    input = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }
  const action = input.action;
  if (!ACTIONS.has(action)) {
    return jsonResponse(400, { error: "invalid_action" });
  }

  const visitorIp =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown";
  const cookieToken =
    (event.headers.cookie || "").match(/(?:^|;\s*)gw_session=([^;]+)/)?.[1] || "";

  const requestBody = JSON.stringify({
    email: typeof input.email === "string" ? input.email : "",
    password: typeof input.password === "string" ? input.password : "",
    session: cookieToken,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = crypto
    .createHmac("sha256", relaySecret)
    .update(`${timestamp}.${visitorIp}.${requestBody}`)
    .digest("hex");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${relayUrl.replace(/\/$/, "")}/auth/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Guilinway-Timestamp": timestamp,
        "X-Guilinway-Signature": signature,
        "X-Guilinway-Visitor-IP": visitorIp,
      },
      body: requestBody,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const passThrough = [400, 401, 409, 429].includes(response.status);
      if (!passThrough) {
        console.error("Auth relay request failed", response.status);
      }
      return jsonResponse(passThrough ? response.status : 502, {
        error: passThrough ? payload.error || "request_failed" : "auth_unavailable",
      });
    }

    if (action === "register" || action === "login") {
      if (!payload.session) {
        return jsonResponse(502, { error: "auth_unavailable" });
      }
      return jsonResponse(200, { ok: true, email: payload.email }, sessionCookie(payload.session));
    }
    if (action === "logout") {
      return jsonResponse(200, { ok: true }, clearCookie());
    }
    return jsonResponse(
      200,
      {
        loggedIn: Boolean(payload.loggedIn),
        email: payload.email || null,
        plan: payload.plan,
        limit: payload.limit,
        remaining: payload.remaining,
      },
      cookieToken && !payload.loggedIn ? clearCookie() : undefined
    );
  } catch (error) {
    console.error("Auth relay connection failed", error.name);
    return jsonResponse(504, { error: "auth_timeout" });
  } finally {
    clearTimeout(timeout);
  }
};
