"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

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
