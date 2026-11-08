"use strict";

const { randomBytes } = require("node:crypto");
const { DynamoDBClient, DeleteItemCommand, GetItemCommand, PutItemCommand, QueryCommand, ScanCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { mapMongoDocumentToDynamoItem } = require("../../lib/migration/dynamodb-mapper");
const { changesFor, collections, mediaId } = require("./schema");
const { groupsFor } = require("../roles");

const db = new DynamoDBClient({});
const table = process.env.MAIN_TABLE;
const files = process.env.FILES_TABLE;
const attrs = (value) => marshall(value, { removeUndefinedValues: true });
const response = (statusCode, value) => ({
  statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(value),
});

exports.handler = async (event) => {
  if (!groupsFor(event).includes("admin")) {
    return response(403, { error: "Administrator access required." });
  }
  try {
    if (event.routeKey === "GET /api/admin/content") return response(200, { collections });
    if (event.routeKey === "GET /api/admin/media") return response(200, { files: await mediaLibrary() });
    const { collection, id } = event.pathParameters || {};
    if (!Object.hasOwn(collections, collection) || (id && !mediaId.test(id))) {
      return response(404, { error: "Collection or record not found." });
    }
    const definition = collections[collection];
    const records = await list(collection);
    if (event.routeKey === "GET /api/admin/content/{collection}") {
      return response(200, { records: records.map((item) => view(definition, item)) });
    }
    const existing = records.find((record) => record.legacyMongoId === id);
    if (id && !existing) return response(404, { error: "Record not found." });
    if (event.isBase64Encoded || Buffer.byteLength(event.body || "") > 65536) {
      return response(413, { error: "Content is too large." });
    }
    const input = JSON.parse(event.body || "{}");
    if (!input || typeof input !== "object" || Array.isArray(input)) return response(400, { error: "Invalid content." });
    if (existing && input.version !== (existing.editRevision || 0)) {
      return response(409, { error: "The record has changed. Reload it before editing." });
    }
    if (event.routeKey === "DELETE /api/admin/content/{collection}/{id}") {
      if (collection === "mains") return response(400, { error: "The main profile cannot be deleted." });
      await db.send(new DeleteItemCommand({ TableName: table, Key: attrs({ pk: existing.pk, sk: existing.sk }), ...condition(existing) }));
      return response(200, { deleted: true });
    }
    if (!existing && collection === "mains") return response(400, { error: "Select the existing profile." });
    const changes = changesFor(definition, input.values);
    if (!Object.keys(changes).length) return response(400, { error: "Change at least one field." });
    await Promise.all(definition.fields.filter(([key, , kind]) => kind === "media" && changes[key]).map(async ([key]) => {
      const file = await db.send(new GetItemCommand({ TableName: files, Key: attrs({ pk: `FILE#${changes[key]}`, sk: "METADATA" }) }));
      if (!file.Item) throw new TypeError("The selected file no longer exists.");
    }));
    const values = { ...existing, ...changes };
    if (collection !== "mains" && !values.title && !values.titleEng) {
      return response(400, { error: "Enter a title." });
    }
    const identifier = id || randomBytes(12).toString("hex");
    const { item: mapped } = mapMongoDocumentToDynamoItem(collection, { ...values, _id: identifier },
      { migrationBatchId: existing?.migrationBatchId || "admin" });
    const next = { ...mapped, sk: existing?.sk || mapped.sk, editRevision: (existing?.editRevision || 0) + 1 };
    await db.send(new PutItemCommand({ TableName: table, Item: attrs(next), ...condition(existing) }));
    return response(existing ? 200 : 201, view(definition, next));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return response(409, { error: "The record has changed. Reload it before editing." });
    if (["Error", "TypeError", "SyntaxError"].includes(error.name)) return response(400, { error: error.message });
    console.error("Portfolio content operation failed", error.name);
    return response(503, { error: "The content service is temporarily unavailable." });
  }
};

function condition(existing) {
  if (!existing) return { ConditionExpression: "attribute_not_exists(pk)" };
  if (!existing.editRevision) return { ConditionExpression: "attribute_exists(pk) AND attribute_not_exists(editRevision)" };
  return { ConditionExpression: "editRevision = :revision", ExpressionAttributeValues: attrs({ ":revision": existing.editRevision }) };
}

function view(definition, item) {
  return { id: item.legacyMongoId, version: item.editRevision || 0,
    values: Object.fromEntries(definition.fields.map(([key]) => [key, item[key] ?? null])) };
}

async function list(collection) {
  const records = [];
  let cursor;
  do {
    const page = await db.send(new QueryCommand({
      TableName: table, KeyConditionExpression: "pk = :pk", ConsistentRead: true,
      ExpressionAttributeValues: attrs({ ":pk": collection === "mains" ? "MAIN" : `MAIN#${collection}` }),
      ExclusiveStartKey: cursor,
    }));
    records.push(...(page.Items || []).map((item) => unmarshall(item)));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return records.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
}

async function mediaLibrary() {
  const result = [];
  let cursor;
  do {
    const page = await db.send(new ScanCommand({ TableName: files, ProjectionExpression: "legacyMongoId, #title, #type, originalName",
      ExpressionAttributeNames: { "#title": "title", "#type": "type" }, ExclusiveStartKey: cursor }));
    for (const item of page.Items || []) {
      const { legacyMongoId: id, title, type, originalName } = unmarshall(item);
      if (mediaId.test(id)) result.push({ id, title: title || originalName || id, type });
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor && result.length < 400);
  return result.slice(0, 400).sort((a, b) => a.title.localeCompare(b.title));
}
