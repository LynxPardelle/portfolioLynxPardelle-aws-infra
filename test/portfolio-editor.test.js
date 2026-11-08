"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { changesFor, collections } = require("../lambda/portfolio-editor/schema");

test("portfolio edits accept editable fields and reject storage keys, secrets and unsafe embeds", () => {
  assert.deepEqual(changesFor(collections.websites, { title: " Nuevo ", order: 2 }), { title: "Nuevo", order: 2 });
  assert.throws(() => changesFor(collections.websites, { pk: "MAIN" }));
  assert.throws(() => changesFor(collections.mains, { key: "secret" }));
  assert.throws(() => changesFor(collections.videos, { insert: "javascript:alert(1)" }));
  assert.throws(() => changesFor(collections.videos, { insert: "https://youtube.com.evil.example/embed/1" }));
  assert.deepEqual(changesFor(collections.videos, { insert: "https://www.youtube.com/embed/1" }), { insert: "https://www.youtube.com/embed/1" });
});
