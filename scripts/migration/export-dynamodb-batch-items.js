#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { BSON } = require("bson");
const {
  expectedCollectionNames,
  inventoryDumpCollections,
  validateRequiredCollections,
} = require("../../lib/migration/dump-inventory");
const {
  collectionTableKeys,
  mapMongoDocumentToDynamoItem,
  toBatchWriteRequest,
} = require("../../lib/migration/dynamodb-mapper");

const dumpRoot = getArgValue("--dump") || "C:\\Users\\lince\\Downloads\\dump";
const environment = getArgValue("--env") || "dev";
const migrationBatchId = getArgValue("--batch-id") || new Date().toISOString().replaceAll(":", "-");
const outputRoot = getArgValue("--out") ||
  path.join("C:\\Users\\lince\\Documents\\Codex\\Output", "portfolioLynxPardelle-dynamodb-import", migrationBatchId);

const inventory = inventoryDumpCollections(dumpRoot);
const validation = validateRequiredCollections(inventory.collections);

if (!validation.ok) {
  console.error(JSON.stringify({
    error: "Mongo dump is missing required portfolio application collections.",
    dumpRoot,
    present: validation.present,
    missing: validation.missing,
    ignoredCollectionCount: validation.ignored.length,
  }, null, 2));
  process.exit(2);
}

fs.mkdirSync(outputRoot, { recursive: true });

const requestsByTable = new Map();
const counts = {};

for (const collectionName of expectedCollectionNames) {
  const entry = inventory.collections.find((candidate) => candidate.collection === collectionName);
  const documents = readBsonDocuments(path.join(dumpRoot, entry.relativePath));
  counts[collectionName] = documents.length;

  for (const document of documents) {
    const mapped = mapMongoDocumentToDynamoItem(collectionName, document, { migrationBatchId });
    const tableName = tableNameFor(environment, mapped.targetTableKey);
    const request = toBatchWriteRequest(tableName, mapped.item)[tableName][0];

    if (!requestsByTable.has(tableName)) {
      requestsByTable.set(tableName, []);
    }
    requestsByTable.get(tableName).push(request);
  }
}

const files = [];
for (const [tableName, requests] of requestsByTable.entries()) {
  let batchNumber = 1;
  for (const batch of chunk(requests, 25)) {
    const fileName = `${tableName}-${String(batchNumber).padStart(4, "0")}.json`;
    const filePath = path.join(outputRoot, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ RequestItems: { [tableName]: batch } }, null, 2));
    files.push({ tableName, fileName, itemCount: batch.length });
    batchNumber += 1;
  }
}

const manifest = {
  migrationBatchId,
  environment,
  dumpRoot,
  generatedAt: new Date().toISOString(),
  counts,
  files,
};
fs.writeFileSync(path.join(outputRoot, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({
  outputRoot,
  migrationBatchId,
  counts,
  fileCount: files.length,
}, null, 2));

function readBsonDocuments(filePath) {
  const buffer = fs.readFileSync(filePath);
  const documents = [];
  let offset = 0;

  while (offset < buffer.length) {
    const documentSize = buffer.readInt32LE(offset);
    if (documentSize <= 0 || offset + documentSize > buffer.length) {
      throw new Error(`Invalid BSON document boundary in ${filePath} at offset ${offset}`);
    }
    documents.push(BSON.deserialize(buffer.subarray(offset, offset + documentSize)));
    offset += documentSize;
  }

  return documents;
}

function tableNameFor(environmentName, targetTableKey) {
  if (!Object.values(collectionTableKeys).includes(targetTableKey)) {
    throw new Error(`Unsupported target table key: ${targetTableKey}`);
  }
  return `portfolio-${environmentName}-${targetTableKey}`;
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}
