"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { ObjectId } = require("bson");

const {
  expectedCollectionNames,
  inventoryDumpCollections,
  validateRequiredCollections,
} = require("../lib/migration/dump-inventory");
const {
  mapMongoDocumentToDynamoItem,
  toBatchWriteRequest,
} = require("../lib/migration/dynamodb-mapper");

test("expectedCollectionNames lists every portfolio MongoDB collection", () => {
  assert.deepEqual(expectedCollectionNames, [
    "albums",
    "articles",
    "articlecats",
    "articlesections",
    "articlesubcats",
    "bookimgs",
    "cvsections",
    "cvsubsections",
    "files",
    "mains",
    "songs",
    "videos",
    "websites",
  ]);
});

test("inventoryDumpCollections reads database and collection names without document contents", () => {
  const dumpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-dump-"));
  fs.mkdirSync(path.join(dumpRoot, "admin"));
  fs.writeFileSync(path.join(dumpRoot, "admin", "system.users.bson"), "");
  fs.writeFileSync(path.join(dumpRoot, "admin", "system.version.bson"), "");

  const inventory = inventoryDumpCollections(dumpRoot);

  assert.deepEqual(inventory.collections, [
    {
      database: "admin",
      collection: "system.users",
      relativePath: "admin/system.users.bson",
    },
    {
      database: "admin",
      collection: "system.version",
      relativePath: "admin/system.version.bson",
    },
  ]);
});

test("validateRequiredCollections reports missing application collections", () => {
  const validation = validateRequiredCollections([
    { database: "admin", collection: "system.users" },
  ]);

  assert.equal(validation.ok, false);
  assert.deepEqual(validation.present, []);
  assert.equal(validation.missing.length, expectedCollectionNames.length);
  assert.equal(validation.ignored.length, 1);
});

test("mapMongoDocumentToDynamoItem preserves legacy ids and deterministic keys", () => {
  const articleId = new ObjectId("665000000000000000000001");
  const catId = new ObjectId("665000000000000000000002");
  const mapped = mapMongoDocumentToDynamoItem("articles", {
    _id: articleId,
    title: "Example",
    cat: catId,
    tags: "aws,portfolio",
    show: true,
    create_at: new Date("2026-06-18T12:00:00.000Z"),
  }, {
    migrationBatchId: "batch-001",
  });

  assert.equal(mapped.targetTableKey, "articles");
  assert.equal(mapped.item.pk, "ARTICLE#665000000000000000000001");
  assert.equal(mapped.item.sk, "METADATA");
  assert.equal(mapped.item.legacyMongoId, "665000000000000000000001");
  assert.equal(mapped.item.cat, "665000000000000000000002");
  assert.equal(mapped.item.create_at, "2026-06-18T12:00:00.000Z");
  assert.equal(mapped.item.migrationBatchId, "batch-001");
});

test("toBatchWriteRequest emits DynamoDB attribute value JSON", () => {
  const request = toBatchWriteRequest("portfolio-dev-articles", {
    pk: "ARTICLE#1",
    sk: "METADATA",
    title: "Example",
    show: true,
    tags: ["aws", "portfolio"],
    missing: null,
  });

  assert.deepEqual(request, {
    "portfolio-dev-articles": [
      {
        PutRequest: {
          Item: {
            pk: { S: "ARTICLE#1" },
            sk: { S: "METADATA" },
            title: { S: "Example" },
            show: { BOOL: true },
            tags: { L: [{ S: "aws" }, { S: "portfolio" }] },
            missing: { NULL: true },
          },
        },
      },
    ],
  });
});
