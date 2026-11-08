"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

function editorEvent(routeKey, groups, tokenUse = "access") {
  return {
    routeKey, body: "{}", requestContext: { authorizer: { jwt: { claims: {
      token_use: tokenUse, "cognito:groups": groups,
    } } } },
  };
}

test("administrators inherit editorial access and unrecognized groups or ID tokens do not", async () => {
  const { editor } = require("../lambda/editorial");
  const route = "POST /api/editorial/preview";
  assert.equal((await editor(editorEvent(route, "[admin]"))).statusCode, 400);
  assert.equal((await editor(editorEvent(route, "[editor]"))).statusCode, 400);
  assert.equal((await editor(editorEvent(route, "[administrator]"))).statusCode, 403);
  assert.equal((await editor(editorEvent(route, "[analytics.admin]"))).statusCode, 403);
  assert.equal((await editor(editorEvent(route, "[admin]", "id"))).statusCode, 403);
});

test("editors cannot use the administrative settings endpoints", async () => {
  const { editor } = require("../lambda/editorial");
  for (const method of ["GET", "PUT"]) {
    assert.equal((await editor(editorEvent(`${method} /api/editorial/settings`, "[editor]"))).statusCode, 403);
  }
});

test("editorial drafts validate bilingual sources and prevent script injection in the rendered copy", () => {
  const { validateDraft, publicArticle } = require("../lambda/editorial/content");
  const input = {
    slug: "ejemplo", category: "technology", eventDate: "2026-11-06",
    sources: ["https://angular.dev/blog", "https://aws.amazon.com/blogs"],
    es: { title: "Ejemplo", markdown: "Hola <script>bad()</script> [mal](javascript:alert(1))" },
    en: { title: "Example", markdown: "Example" },
  };
  assert.throws(() => validateDraft({ ...input, en: undefined }, true));
  const draft = validateDraft(input, true);
  const article = publicArticle({ ...draft, version: 1 }, "2026-11-07T12:00:00Z");
  assert.equal(article.show, true);
  assert.match(article.intro, /&lt;script&gt;/);
  assert.doesNotMatch(article.intro, /href="javascript:|<script>/);
  assert.equal(article.urltitle, "ejemplo");
});

test("automation accepts only eligible recent drafts for autopublishing", () => {
  const { eligibleForAutopublish } = require("../lambda/editorial/content");
  const now = new Date("2026-11-07T12:00:00Z");
  const draft = { origin: "desktop", category: "technology", eventDate: "2026-11-06" };
  assert.equal(eligibleForAutopublish(draft, now), true);
  assert.equal(eligibleForAutopublish({ ...draft, eventDate: "2026-10-01" }, now), false);
  assert.equal(eligibleForAutopublish({ ...draft, origin: "manual" }, now), false);
});

test("test taxonomy stays private even when the article would otherwise be visible", () => {
  const { validateDraft, publicArticle, isPublicArticle } = require("../lambda/editorial/content");
  const base = { slug: "muestra", category: "test", subcategories: ["control-editorial"], tags: ["test"],
    es: { title: "Muestra", markdown: "Vista privada." } };
  const draft = validateDraft(base);
  assert.deepEqual(draft.subcategories, ["control-editorial"]);
  assert.deepEqual(draft.tags, ["test"]);
  assert.equal(isPublicArticle(publicArticle(draft, "2026-11-07T12:00:00Z")), false);
  assert.equal(isPublicArticle({ show: true, tags: "angular, TEST" }), false);
  assert.equal(isPublicArticle({ show: true, tags: "testing, angular" }), true);
});
