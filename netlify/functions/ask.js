const crypto = require("node:crypto");

const MAX_MESSAGE_LENGTH = 1200;
const REQUEST_TIMEOUT_MS = 125000;

const jsonResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  },
  body: JSON.stringify(payload),
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const relayUrl = process.env.HERMES_RELAY_URL;
  const relaySecret = process.env.HERMES_RELAY_SECRET;
  if (!relayUrl || !relaySecret) {
    console.error("Hermes relay environment variables are not configured");
    return jsonResponse(503, { error: "assistant_not_configured" });
  }

  let message;
  try {
    ({ message } = JSON.parse(event.body || "{}"));
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    return jsonResponse(400, { error: "invalid_message" });
  }

  const visitorIp =
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    "unknown";
  const sessionToken =
    (event.headers.cookie || "").match(/(?:^|;\s*)gw_session=([^;]+)/)?.[1] || "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const requestBody = JSON.stringify({ message: message.trim(), session: sessionToken });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto
      .createHmac("sha256", relaySecret)
      .update(`${timestamp}.${visitorIp}.${requestBody}`)
      .digest("hex");
    const response = await fetch(`${relayUrl.replace(/\/$/, "")}/ask`, {
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
      if (response.status === 429) {
        return jsonResponse(429, {
          error: payload.error || "rate_limited",
          limit: payload.limit,
          plan: payload.plan,
        });
      }
      console.error("Hermes relay request failed", response.status, payload.error || "unknown");
      return jsonResponse(502, { error: "assistant_unavailable" });
    }
    if (typeof payload.answer !== "string" || !payload.answer) {
      return jsonResponse(502, { error: "invalid_assistant_response" });
    }
    return jsonResponse(200, {
      answer: payload.answer,
      remaining: payload.remaining,
      limit: payload.limit,
      plan: payload.plan,
    });
  } catch (error) {
    console.error("Hermes relay connection failed", error.name);
    return jsonResponse(504, { error: "assistant_timeout" });
  } finally {
    clearTimeout(timeout);
  }
};
