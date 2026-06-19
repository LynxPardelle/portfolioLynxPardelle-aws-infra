"use strict";

process.env.MAIN_TABLE = "portfolio-dev-main";
process.env.ARTICLES_TABLE = "portfolio-dev-articles";
process.env.ARTICLE_SECTIONS_TABLE = "portfolio-dev-article-sections";
process.env.ARTICLE_CATEGORIES_TABLE = "portfolio-dev-article-categories";
process.env.FILES_TABLE = "portfolio-dev-files";
process.env.ASSETS_BUCKET = "lynx-portfolio";
process.env.ASSETS_DOMAIN = "assets.lynxpardelle.com";

const assert = require("node:assert/strict");
const test = require("node:test");
const { handler, __test } = require("../lambda/public-api/index");

test("article list returns success with an empty collection instead of 404", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  __test.setDynamoClientForTest({
    send: async () => ({
      Items: [],
    }),
  });

  const response = await handler({
    rawPath: "/api/article/articles/1/5/_id/all/all",
    requestContext: {
      http: {
        method: "GET",
        path: "/api/article/articles/1/5/_id/all/all",
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), {
    status: "success",
    total_items: 0,
    pages: 0,
    articles: [],
  });
});
