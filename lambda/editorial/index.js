"use strict";

const { createHash, timingSafeEqual } = require("node:crypto");
const { DynamoDBClient, GetItemCommand, PutItemCommand, ScanCommand, TransactWriteItemsCommand } = require("@aws-sdk/client-dynamodb");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { eligibleForAutopublish, publicArticle, slugPattern, validateDraft } = require("./content");
const { isTestArticle } = require("../article-visibility");
const { groupsFor } = require("../roles");

const db = new DynamoDBClient({});
const ssm = new SSMClient({});
const drafts = process.env.DRAFTS_TABLE;
const articles = process.env.ARTICLES_TABLE;
const settingsKey = "SETTINGS";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const attrs = (item) => marshall(item, { removeUndefinedValues: true });
const response = (statusCode, value) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(value) });

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function body(event) {
  if (event.isBase64Encoded || Buffer.byteLength(event.body || "") > 65536) throw new RequestError(413, "Payload too large.");
  try { return JSON.parse(event.body || "{}"); } catch { throw new RequestError(400, "Invalid JSON."); }
}

function draftInput(value, automated) {
  try { return validateDraft(value, automated); } catch (error) { throw new RequestError(400, error.message); }
}

async function read(table, key) {
  const result = await db.send(new GetItemCommand({ TableName: table, Key: attrs(key), ConsistentRead: true }));
  return result.Item && unmarshall(result.Item);
}

async function listDrafts() {
  const items = [];
  let cursor;
  do {
    const result = await db.send(new ScanCommand({ TableName: drafts, ExclusiveStartKey: cursor,
      FilterExpression: "begins_with(pk, :draft)", ExpressionAttributeValues: attrs({ ":draft": "DRAFT#" }) }));
    items.push(...(result.Items || []).map(unmarshall));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function settings() {
  return await read(drafts, { pk: settingsKey }) || { pk: settingsKey, streak: 0, auto: false, version: 0 };
}

function versionedPut(table, item, expectedVersion) {
  return { TableName: table, Item: attrs(item), ConditionExpression: expectedVersion ? "#v = :version" : "attribute_not_exists(pk)",
    ...(expectedVersion && { ExpressionAttributeNames: { "#v": "version" }, ExpressionAttributeValues: attrs({ ":version": expectedVersion }) }) };
}

function weekKey(now) {
  const day = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(now));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return `WEEK#${day.toISOString().slice(0, 10)}`;
}

async function publish(draft, policy, now, automatic) {
  if (isTestArticle(draft)) throw new RequestError(409, "Test articles are private.");
  if (draft.status === "published") return draft;
  const date = now.toISOString();
  const eligible = eligibleForAutopublish(draft, now);
  if (automatic && (!policy.auto || !eligible || draft.status !== "draft")) return draft;
  const published = { ...draft, status: "published", version: draft.version + 1, publishedAt: draft.publishedAt || date, updatedAt: date };
  const article = publicArticle(published, date);
  const operations = [{ Put: versionedPut(drafts, published, draft.version) }, { Put: { TableName: articles, Item: attrs(article) } }];
  if (draft.origin === "desktop") {
    const next = { ...policy, streak: automatic ? policy.streak : eligible ? policy.streak + 1 : 0, version: policy.version + 1 };
    operations.push({ Put: versionedPut(drafts, next, policy.version) });
    operations.push({ Update: { TableName: drafts, Key: attrs({ pk: weekKey(now) }),
      UpdateExpression: "ADD #n :one", ConditionExpression: "attribute_not_exists(#n) OR #n < :max",
      ExpressionAttributeNames: { "#n": "count" }, ExpressionAttributeValues: attrs({ ":one": 1, ":max": 3 }) } });
  }
  await db.send(new TransactWriteItemsCommand({ TransactItems: operations }));
  return published;
}

function conflict(error) {
  return ["ConditionalCheckFailedException", "TransactionCanceledException"].includes(error.name);
}

function route(handler) {
  return async (event) => {
    try { return await handler(event); } catch (error) {
      if (error instanceof RequestError) return response(error.status, { error: error.message });
      if (conflict(error)) return response(409, { error: "A concurrent edit or publication limit prevented this update. Refresh and try again." });
      console.error("editorial_failure", error.name);
      return response(503, { error: "Editorial service unavailable." });
    }
  };
}

exports.config = async () => response(200, { domain: process.env.LOGIN_DOMAIN, clientId: process.env.LOGIN_CLIENT });

exports.ingest = route(async (event) => {
  const token = /^Bearer ([a-f0-9]{64})$/.exec(event.headers?.authorization || "")?.[1];
  if (!token) throw new RequestError(401, "Unauthorized.");
  const parameter = await ssm.send(new GetParameterCommand({ Name: process.env.INGEST_HASH_PARAMETER }));
  const expected = parameter.Parameter?.Value || "";
  if (!/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(expected), Buffer.from(digest(token)))) {
    throw new RequestError(401, "Unauthorized.");
  }
  const input = draftInput(body(event), true);
  const pk = `DRAFT#${input.slug}`;
  const fingerprint = digest(JSON.stringify(input));
  const existing = await read(drafts, { pk });
  if (existing) {
    if (existing.fingerprint !== fingerprint) throw new RequestError(409, "This topic already exists.");
    return response(200, { slug: input.slug });
  }
  const now = new Date().toISOString();
  try {
    await db.send(new PutItemCommand(versionedPut(drafts, { ...input, pk, fingerprint, origin: "desktop", status: "draft", version: 1, updatedAt: now }, 0)));
  } catch (error) {
    if (!conflict(error) || (await read(drafts, { pk }))?.fingerprint !== fingerprint) throw error;
  }
  return response(201, { slug: input.slug });
});

exports.editor = route(async (event) => {
  const groups = groupsFor(event);
  const admin = groups.includes("admin");
  if (!admin && !groups.includes("editor")) {
    throw new RequestError(403, "Editor access required.");
  }
  if (["GET /api/editorial/settings", "PUT /api/editorial/settings"].includes(event.routeKey) && !admin) {
    throw new RequestError(403, "Administrator access required.");
  }
  if (event.routeKey === "GET /api/editorial/settings") {
    return response(200, await settings());
  }
  if (event.routeKey === "GET /api/editorial/drafts") {
    const policy = await settings();
    const items = await listDrafts();
    return response(200, { drafts: admin ? items : items.filter((draft) => !isTestArticle(draft)), policy });
  }
  const payload = body(event);
  if (event.routeKey === "POST /api/editorial/preview") {
    const draft = draftInput(payload, false);
    if (isTestArticle(draft) && !admin) throw new RequestError(403, "Administrator access required for test articles.");
    const rendered = publicArticle(draft, new Date().toISOString());
    return response(200, { es: rendered.intro, en: rendered.introEng });
  }
  if (event.routeKey === "PUT /api/editorial/settings") {
    const policy = await settings();
    if (typeof payload.auto !== "boolean" || (payload.auto && policy.streak < 6)) throw new RequestError(400, "Six consecutive approvals are required.");
    const next = { ...policy, auto: payload.auto, version: policy.version + 1 };
    await db.send(new PutItemCommand(versionedPut(drafts, next, policy.version)));
    return response(200, next);
  }
  const slug = event.pathParameters?.slug;
  if (!slug || slug.length > 80 || !slugPattern.test(slug)) throw new RequestError(400, "Invalid slug.");
  const pk = `DRAFT#${slug}`;
  const existing = await read(drafts, { pk });
  if (existing && isTestArticle(existing) && !admin) throw new RequestError(403, "Administrator access required for test articles.");
  if ((existing?.version || 0) !== payload.version) throw new RequestError(409, "The draft has changed. Refresh it first.");
  const now = new Date();
  if (event.routeKey === "PUT /api/editorial/drafts/{slug}") {
    const input = draftInput({ ...payload, slug }, existing?.origin === "desktop");
    const next = { ...existing, ...input, pk, origin: existing?.origin || "manual", status: "draft", version: payload.version + 1, updatedAt: now.toISOString() };
    const test = isTestArticle(input);
    if (test && !admin) throw new RequestError(403, "Administrator access required for test articles.");
    if (test && existing?.publishedAt) {
      delete next.publishedAt;
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Put: versionedPut(drafts, next, payload.version) }, articleDeletion(slug),
      ] }));
    } else {
      await db.send(new PutItemCommand(versionedPut(drafts, next, payload.version)));
    }
    return response(200, next);
  }
  if (!existing) throw new RequestError(404, "Draft not found.");
  if (event.routeKey === "DELETE /api/editorial/drafts/{slug}") {
    if (!admin) throw new RequestError(403, "Administrator access required.");
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Delete: { TableName: drafts, Key: attrs({ pk }), ConditionExpression: "#v = :v",
        ExpressionAttributeNames: { "#v": "version" }, ExpressionAttributeValues: attrs({ ":v": payload.version }) } },
      articleDeletion(slug),
    ] }));
    return response(200, { deleted: true });
  }
  const action = event.pathParameters.action;
  if (action === "publish") return response(200, await publish(existing, await settings(), now, false));
  if (!["withdraw", "reject"].includes(action)) throw new RequestError(404, "Unknown action.");
  const next = { ...existing, status: action === "reject" ? "rejected" : "withdrawn", version: existing.version + 1, updatedAt: now.toISOString() };
  const operations = [{ Put: versionedPut(drafts, next, existing.version) }];
  if (action === "withdraw" || existing.publishedAt) operations.push(articleDeletion(slug));
  if (action === "reject" && existing.origin === "desktop") {
    const policy = await settings();
    operations.push({ Put: versionedPut(drafts, { ...policy, streak: 0, auto: false, version: policy.version + 1 }, policy.version) });
  }
  await db.send(new TransactWriteItemsCommand({ TransactItems: operations }));
  return response(200, next);
});

function articleDeletion(slug) {
  return { Delete: { TableName: articles, Key: attrs({ pk: `ARTICLE#editorial-${slug}`, sk: "METADATA" }) } };
}

exports.autopublish = async () => {
  const policy = await settings();
  if (!policy.auto) return;
  const now = new Date();
  const candidate = (await listDrafts()).reverse().find((draft) => draft.status === "draft" && draft.version === 1 && eligibleForAutopublish(draft, now));
  if (!candidate) return;
  try { await publish(candidate, policy, now, true); } catch (error) { if (!conflict(error)) throw error; }
};
