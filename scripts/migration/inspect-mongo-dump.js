#!/usr/bin/env node
"use strict";

const {
  inventoryDumpCollections,
  validateRequiredCollections,
} = require("../../lib/migration/dump-inventory");

const dumpRoot = getArgValue("--dump") || "C:\\Users\\lince\\Downloads\\dump";
const inventory = inventoryDumpCollections(dumpRoot);
const validation = validateRequiredCollections(inventory.collections);

console.log(JSON.stringify({
  dumpRoot,
  collectionCount: inventory.collections.length,
  collections: inventory.collections.map((entry) => ({
    database: entry.database,
    collection: entry.collection,
    relativePath: entry.relativePath,
  })),
  validation,
}, null, 2));

process.exitCode = validation.ok ? 0 : 2;

function getArgValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}
