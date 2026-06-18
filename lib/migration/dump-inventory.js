"use strict";

const fs = require("node:fs");
const path = require("node:path");

const expectedCollectionNames = Object.freeze([
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

function inventoryDumpCollections(dumpRoot) {
  const collections = [];

  for (const databaseEntry of safeReadDir(dumpRoot)) {
    if (!databaseEntry.isDirectory()) {
      continue;
    }

    const databasePath = path.join(dumpRoot, databaseEntry.name);
    for (const collectionEntry of safeReadDir(databasePath)) {
      if (!collectionEntry.isFile() || !collectionEntry.name.endsWith(".bson")) {
        continue;
      }

      collections.push({
        database: databaseEntry.name,
        collection: collectionEntry.name.replace(/\.bson$/, ""),
        relativePath: path
          .relative(dumpRoot, path.join(databasePath, collectionEntry.name))
          .replaceAll(path.sep, "/"),
      });
    }
  }

  return {
    dumpRoot,
    collections: collections.sort((left, right) =>
      `${left.database}/${left.collection}`.localeCompare(`${right.database}/${right.collection}`)
    ),
  };
}

function validateRequiredCollections(collections) {
  const expected = new Set(expectedCollectionNames);
  const presentSet = new Set();
  const ignored = [];

  for (const entry of collections) {
    if (expected.has(entry.collection)) {
      presentSet.add(entry.collection);
    } else {
      ignored.push(entry);
    }
  }

  const present = expectedCollectionNames.filter((collection) => presentSet.has(collection));
  const missing = expectedCollectionNames.filter((collection) => !presentSet.has(collection));

  return {
    ok: missing.length === 0,
    present,
    missing,
    ignored,
  };
}

function safeReadDir(directoryPath) {
  try {
    return fs.readdirSync(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

module.exports = {
  expectedCollectionNames,
  inventoryDumpCollections,
  validateRequiredCollections,
};
