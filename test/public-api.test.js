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
const { marshall } = require("@aws-sdk/util-dynamodb");
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

test("public media payloads expose CDN metadata without raw S3 location fields", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";
  const rawS3Location = "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png";
  const cdnUrl = "https://assets.lynxpardelle.com/uploads/main/image.png";

  __test.setDynamoClientForTest({
    send: async (command) => {
      if (command.constructor.name === "QueryCommand") {
        return {
          Items: [
            marshall({
              pk: "MAIN#bookimgs",
              sk: `BOOKIMG#${fileId}`,
              entityType: "bookimgs",
              legacyMongoId: "book-img-id",
              img: fileId,
            }),
          ],
        };
      }

      if (command.constructor.name === "BatchGetItemCommand") {
        return {
          Responses: {
            [process.env.FILES_TABLE]: [
              marshall({
                pk: `FILE#${fileId}`,
                sk: "METADATA",
                entityType: "files",
                legacyMongoId: fileId,
                title: "image.png",
                location: rawS3Location,
                s3Url: rawS3Location,
                s3Key: "uploads/main/image.png",
                cdnUrl,
              }),
            ],
          },
        };
      }

      return {};
    },
  });

  const response = await handler({
    rawPath: "/api/main/book-imgs",
    requestContext: {
      http: {
        method: "GET",
        path: "/api/main/book-imgs",
      },
    },
  });

  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.bookImgs[0].img.cdnUrl, cdnUrl);
  assert.equal(body.bookImgs[0].img.location, undefined);
  assert.equal(body.bookImgs[0].img.s3Url, undefined);
  assert.doesNotMatch(response.body, /lynx-portfolio\.s3\.us-east-1\.amazonaws\.com/);
});

test("file-info omits raw S3 URL while preserving CDN URL and S3 key", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";
  const rawS3Location = "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png";
  const cdnUrl = "https://assets.lynxpardelle.com/uploads/main/image.png";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        title: "image.png",
        location: rawS3Location,
        s3Url: rawS3Location,
        s3Key: "uploads/main/image.png",
        cdnUrl,
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/file-info/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/file-info/${fileId}`,
      },
    },
  });

  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.file.cdnUrl, cdnUrl);
  assert.equal(body.file.s3Key, "uploads/main/image.png");
  assert.equal(body.file.s3Url, undefined);
  assert.doesNotMatch(response.body, /lynx-portfolio\.s3\.us-east-1\.amazonaws\.com/);
});

test("get-file redirects to CDN URL first", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";
  const cdnUrl = "https://assets.lynxpardelle.com/uploads/main/image.png";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        location: "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png",
        s3Key: "uploads/main/other.png",
        cdnUrl,
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/get-file/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/get-file/${fileId}`,
      },
    },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, cdnUrl);
});

test("get-file builds CDN URL from S3 key before raw location fallback", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        location: "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png",
        s3Key: "uploads/main/image with spaces.png",
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/get-file/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/get-file/${fileId}`,
      },
    },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "https://assets.lynxpardelle.com/uploads/main/image%20with%20spaces.png");
});

test("get-file keeps raw S3 location as compatibility fallback only", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";
  const rawS3Location = "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        location: rawS3Location,
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/get-file/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/get-file/${fileId}`,
      },
    },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, rawS3Location);
});

test("get-file keeps raw S3 URL as final compatibility fallback", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";
  const rawS3Url = "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        s3Url: rawS3Url,
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/get-file/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/get-file/${fileId}`,
      },
    },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, rawS3Url);
});

test("get-file prefers raw S3 location before raw S3 URL fallback", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";
  const rawS3Location = "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/location.png";
  const rawS3Url = "https://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/s3-url.png";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        location: rawS3Location,
        s3Url: rawS3Url,
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/get-file/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/get-file/${fileId}`,
      },
    },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, rawS3Location);
});

test("get-file rejects untrusted redirect fallback URLs", async (t) => {
  t.after(() => __test.resetDynamoClientForTest());

  const fileId = "620324b4c602df79df1e8bc9";

  __test.setDynamoClientForTest({
    send: async () => ({
      Item: marshall({
        pk: `FILE#${fileId}`,
        sk: "METADATA",
        entityType: "files",
        legacyMongoId: fileId,
        cdnUrl: "https://example.com/not-assets.png",
        location: "https://evil.example.com/uploads/main/image.png",
        s3Url: "http://lynx-portfolio.s3.us-east-1.amazonaws.com/uploads/main/image.png",
      }),
    }),
  });

  const response = await handler({
    rawPath: `/api/main/get-file/${fileId}`,
    requestContext: {
      http: {
        method: "GET",
        path: `/api/main/get-file/${fileId}`,
      },
    },
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.headers.location, undefined);
});
