"use strict";

function hasGroup(claims, group) {
  if (claims?.token_use !== "access") return false;
  const groups = String(claims["cognito:groups"] || "").replace(/^\[|\]$/g, "").split(",").map((value) => value.trim());
  return groups.includes(group);
}

module.exports = { hasGroup };
