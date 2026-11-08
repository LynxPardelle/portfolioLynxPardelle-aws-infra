"use strict";

function groupsFor(event) {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  if (claims?.token_use !== "access" || !claims.sub || !claims.iss) return [];
  const header = event.headers?.authorization;
  const token = typeof header === "string" && /^Bearer [\w-]+\.([\w-]+)\.[\w-]+$/i.exec(header);
  if (!token) return [];
  try {
    // API Gateway validates this bearer token. Read its original array because the authorizer context flattens list claims.
    const payload = JSON.parse(Buffer.from(token[1], "base64url").toString("utf8"));
    if (payload?.token_use !== "access" || payload.sub !== claims.sub || payload.iss !== claims.iss) return [];
    const groups = payload["cognito:groups"];
    return Array.isArray(groups) ? groups : [];
  } catch {
    return [];
  }
}

module.exports = { groupsFor };
