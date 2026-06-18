"use strict";

const { ObjectId } = require("bson");

const collectionTableKeys = Object.freeze({
  albums: "main",
  articles: "articles",
  articlecats: "article-categories",
  articlesections: "article-sections",
  articlesubcats: "article-categories",
  bookimgs: "main",
  cvsections: "main",
  cvsubsections: "main",
  files: "files",
  mains: "main",
  songs: "main",
  videos: "main",
  websites: "main",
});

function mapMongoDocumentToDynamoItem(collectionName, document, options = {}) {
  const id = normalizeScalar(document._id);
  if (!id) {
    throw new Error(`Document in ${collectionName} is missing _id`);
  }

  const targetTableKey = collectionTableKeys[collectionName];
  if (!targetTableKey) {
    throw new Error(`Unsupported MongoDB collection: ${collectionName}`);
  }

  const normalizedDocument = normalizeDocument(document);
  delete normalizedDocument._id;

  const keys = buildKeys(collectionName, id, normalizedDocument);
  const item = {
    ...normalizedDocument,
    ...keys,
    collection: collectionName,
    entityType: collectionName,
    legacyMongoId: id,
    migrationBatchId: options.migrationBatchId || "manual",
  };

  return {
    targetTableKey,
    item,
  };
}

function buildKeys(collectionName, id, document) {
  if (collectionName === "mains") {
    return {
      pk: "MAIN",
      sk: `PROFILE#${id}`,
      gsi1pk: "MAIN#mains",
      gsi1sk: `PROFILE#${id}`,
    };
  }

  if (collectionName === "articles") {
    return {
      pk: `ARTICLE#${id}`,
      sk: "METADATA",
      gsi1pk: document.urltitle ? "ARTICLE#URLTITLE" : "ARTICLE#ALL",
      gsi1sk: document.urltitle || `CREATED#${document.create_at || id}`,
    };
  }

  if (collectionName === "articlesections") {
    const articleId = document.article || "unknown";
    return {
      pk: `ARTICLE#${articleId}`,
      sk: `SECTION#${paddedOrder(document.order)}#${id}`,
      gsi1pk: "ARTICLE_SECTION#ALL",
      gsi1sk: `ORDER#${paddedOrder(document.order)}#${id}`,
    };
  }

  if (collectionName === "articlecats") {
    return {
      pk: `ARTICLECAT#${id}`,
      sk: "METADATA",
      gsi1pk: "ARTICLECAT#ALL",
      gsi1sk: `TITLE#${document.title || id}`,
    };
  }

  if (collectionName === "articlesubcats") {
    return {
      pk: `ARTICLESUBCAT#${id}`,
      sk: "METADATA",
      gsi1pk: document.cat ? `ARTICLECAT#${document.cat}` : "ARTICLESUBCAT#ALL",
      gsi1sk: `TITLE#${document.title || id}`,
    };
  }

  if (collectionName === "files") {
    return {
      pk: `FILE#${id}`,
      sk: "METADATA",
      gsi1pk: document.s3Key ? "FILE#S3KEY" : "FILE#ALL",
      gsi1sk: document.s3Key || id,
    };
  }

  return {
    pk: `MAIN#${collectionName}`,
    sk: `ORDER#${paddedOrder(document.order)}#${id}`,
    gsi1pk: `MAIN#${collectionName}`,
    gsi1sk: `ORDER#${paddedOrder(document.order)}#${id}`,
  };
}

function toBatchWriteRequest(tableName, item) {
  return {
    [tableName]: [
      {
        PutRequest: {
          Item: toAttributeMap(item),
        },
      },
    ],
  };
}

function toAttributeMap(item) {
  const attributeMap = {};

  for (const [key, value] of Object.entries(item)) {
    if (value !== undefined) {
      attributeMap[key] = toAttributeValue(value);
    }
  }

  return attributeMap;
}

function toAttributeValue(value) {
  if (value === null) {
    return { NULL: true };
  }

  if (value instanceof Date) {
    return { S: value.toISOString() };
  }

  if (isObjectId(value)) {
    return { S: value.toHexString() };
  }

  if (Array.isArray(value)) {
    return { L: value.map(toAttributeValue) };
  }

  switch (typeof value) {
    case "string":
      return { S: value };
    case "number":
      return { N: String(value) };
    case "boolean":
      return { BOOL: value };
    case "object":
      return { M: toAttributeMap(value) };
    default:
      return { S: String(value) };
  }
}

function normalizeDocument(document) {
  const normalized = {};

  for (const [key, value] of Object.entries(document)) {
    normalized[key] = normalizeScalar(value);
  }

  return normalized;
}

function normalizeScalar(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (isObjectId(value)) {
    return value.toHexString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeScalar);
  }

  if (value && typeof value === "object") {
    const normalized = {};
    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      normalized[nestedKey] = normalizeScalar(nestedValue);
    }
    return normalized;
  }

  return value;
}

function isObjectId(value) {
  return value instanceof ObjectId || value?._bsontype === "ObjectId";
}

function paddedOrder(order) {
  if (typeof order !== "number" || Number.isNaN(order)) {
    return "999999";
  }
  return String(order).padStart(6, "0");
}

module.exports = {
  collectionTableKeys,
  mapMongoDocumentToDynamoItem,
  toAttributeMap,
  toAttributeValue,
  toBatchWriteRequest,
};
