"use strict";

const {
  BatchGetItemCommand,
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  ScanCommand,
} = require("@aws-sdk/client-dynamodb");
const { unmarshall } = require("@aws-sdk/util-dynamodb");

let client = new DynamoDBClient({});
const entityIndexName = "ByEntity";

const tables = {
  main: process.env.MAIN_TABLE,
  articles: process.env.ARTICLES_TABLE,
  articleSections: process.env.ARTICLE_SECTIONS_TABLE,
  articleCategories: process.env.ARTICLE_CATEGORIES_TABLE,
  files: process.env.FILES_TABLE,
};

const mainRoutes = Object.freeze({
  "/api/main/albums": {
    collection: "albums",
    responseKey: "albums",
    fileFields: ["img"],
    errorMessage: "Error al devolver los album.",
  },
  "/api/main/book-imgs": {
    collection: "bookimgs",
    responseKey: "bookImgs",
    fileFields: ["img"],
    errorMessage: "Error al devolver los bookImg.",
  },
  "/api/main/songs": {
    collection: "songs",
    responseKey: "songs",
    fileFields: ["song", "coverArt"],
    errorMessage: "Error al devolver los song.",
  },
  "/api/main/videos": {
    collection: "videos",
    responseKey: "videos",
    fileFields: ["video"],
    errorMessage: "Error al devolver los videos.",
  },
  "/api/main/web-sites": {
    collection: "websites",
    responseKey: "websites",
    fileFields: ["desktopImg", "tabletImg", "mobileImg"],
    errorMessage: "Error al devolver los website.",
  },
});

exports.handler = async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || "GET";
  const requestPath = normalizePath(
    event.rawPath || event.path || event.requestContext?.http?.path || "/"
  );

  try {
    if (method === "OPTIONS") {
      return empty(204);
    }

    if (method !== "GET" && method !== "HEAD") {
      return json(405, {
        status: "error",
        message: "Method not allowed.",
      });
    }

    const response = await route(requestPath);
    if (method === "HEAD") {
      return { ...response, body: "" };
    }
    return response;
  } catch (error) {
    console.error("Public API request failed", {
      path: requestPath,
      method,
      message: error.message,
    });
    return json(500, {
      status: "error",
      message: "Error al procesar la solicitud.",
      error_message: error.message,
    });
  }
};

async function route(pathname) {
  if (pathname === "/") {
    return json(200, {
      author: "Lynx Pardelle",
      url: "https://www.lynxpardelle.com",
    });
  }

  if (pathname === "/health") {
    return json(200, {
      status: "ok",
      app: "lynx-portfolio-back",
      timestamp: new Date().toISOString(),
      storage: {
        mode: "s3-only",
        bucket: process.env.ASSETS_BUCKET || "not-configured",
        region: process.env.AWS_REGION || "not-configured",
        cdnDomain: process.env.ASSETS_DOMAIN || "not-configured",
      },
    });
  }

  if (pathname === "/api/main/datos-autor" || pathname === "/api/article/datos-autor") {
    return json(200, {
      autor: "Lynx Pardelle",
      url: "https://www.lynxpardelle.com",
    });
  }

  if (pathname === "/api/main/s3-status") {
    return json(200, {
      success: true,
      s3Configured: Boolean(process.env.ASSETS_BUCKET),
      cloudfrontConfigured: Boolean(process.env.ASSETS_DOMAIN),
      storageMode: "s3-only",
      timestamp: new Date().toISOString(),
    });
  }

  if (mainRoutes[pathname]) {
    return getMainCollection(mainRoutes[pathname]);
  }

  if (pathname === "/api/main/cv-sections") {
    return getCvSections();
  }

  if (pathname === "/api/main/main") {
    return getMainProfile();
  }

  const fileInfoMatch = pathname.match(/^\/api\/main\/file-info\/([^/]+)$/);
  if (fileInfoMatch) {
    return getFileInfo(safeDecode(fileInfoMatch[1]));
  }

  const fileMatch = pathname.match(/^\/api\/main\/get-file\/([^/]+)$/);
  if (fileMatch) {
    return getFile(safeDecode(fileMatch[1]));
  }

  if (pathname === "/api/article/article-cats") {
    return getArticleCategories();
  }

  if (pathname === "/api/article/article-sub-cats") {
    return getArticleSubCategories();
  }

  const articleMatch = pathname.match(/^\/api\/article\/article\/([^/]+)$/);
  if (articleMatch) {
    return getArticle(safeDecode(articleMatch[1]));
  }

  if (pathname === "/api/article/articles" || pathname.startsWith("/api/article/articles/")) {
    return getArticles(pathname);
  }

  return json(404, {
    status: "error",
    message: "Route not found.",
  });
}

async function getMainCollection(routeConfig) {
  const docs = await listMainCollection(routeConfig.collection);
  const populated = await populateFileFieldsForDocs(docs, routeConfig.fileFields);
  return json(200, {
    status: "success",
    [routeConfig.responseKey]: populated,
  });
}

async function getCvSections() {
  const [sections, subsections] = await Promise.all([
    listMainCollection("cvsections"),
    listMainCollection("cvsubsections"),
  ]);
  const subsectionsById = byId(subsections);
  const cvSections = sections.map((section) => ({
    ...section,
    CVSubSections: resolveReferenceList(section.CVSubSections, subsectionsById),
  }));

  return json(200, {
    status: "success",
    cvSections,
  });
}

async function getMainProfile() {
  const docs = await queryByPk(tables.main, "MAIN");
  if (docs.length === 0) {
    return json(404, {
      status: "error",
      message: "No hay main.",
    });
  }

  const [main] = await populateFileFieldsForDocs([docs[0]], [
    "logo",
    "backgroundImg",
    "CVImage",
    "CVBackground",
  ]);
  delete main.key;
  delete main.keyOld;

  return json(200, {
    status: "success",
    main,
  });
}

async function getFile(id) {
  if (!isLegacyObjectId(id)) {
    return json(400, {
      status: "error",
      message: "Invalid file ID format",
      code: "INVALID_FILE_ID",
    });
  }

  const file = await getFileById(id, { exposeRawS3Location: true });
  const targetUrl =
    file && firstAllowedFileRedirectUrl([file.cdnUrl, buildCdnUrl(file.s3Key), file.location, file.s3Url]);
  if (targetUrl) {
    return redirect(targetUrl);
  }

  return json(404, {
    status: "error",
    message: "El archivo no existe en el sistema de archivos S3.",
    code: "FILE_NOT_FOUND",
    strategy: "s3-only",
    hint: "Este sistema usa solo almacenamiento S3. Verifique que el archivo haya sido migrado.",
  });
}

async function getFileInfo(id) {
  const file = await getFileById(id);
  if (!file) {
    return json(404, {
      status: "error",
      message: "File not found",
    });
  }

  return json(200, {
    status: "success",
    file: {
      id: file._id,
      filename: file.title || file.titleEng || "Unknown",
      originalFilename: file.metadata?.originalName || file.title,
      size: file.size,
      type: file.type,
      mimeType: file.metadata?.mimeType,
      cdnUrl: file.cdnUrl || buildCdnUrl(file.s3Key),
      s3Key: file.s3Key,
      checksums: file.checksums,
      metadata: file.metadata,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    },
  });
}

async function getArticleCategories() {
  const { categories, subcategoriesById } = await loadArticleCategoryGraph();
  const articleCats = categories.map((category) => categoryWithSubcats(category, subcategoriesById));

  return json(200, {
    status: "success",
    articleCats,
  });
}

async function getArticleSubCategories() {
  const { categoriesById, subcategories, subcategoriesById } = await loadArticleCategoryGraph();
  const articleSubCats = subcategories.map((subcategory) =>
    subcategoryWithCategory(subcategory, categoriesById, subcategoriesById)
  );

  return json(200, {
    status: "success",
    articleSubCats,
  });
}

async function getArticles(pathname) {
  const params = parseArticleListPath(pathname);
  const allArticles = await scanByEntity(tables.articles, "articles");
  const filtered = await filterArticles(allArticles, params);
  const sorted = sortDocuments(filtered, params.sort);
  const total = sorted.length;

  if (total === 0) {
    return json(200, {
      status: "success",
      total_items: 0,
      pages: 0,
      articles: [],
    });
  }

  const articles = await Promise.all(paginate(sorted, params).map(populateArticle));
  const itemsPerPage = params.itemsPerPage > 0 ? params.itemsPerPage : total;

  return json(200, {
    status: "success",
    total_items: total,
    pages: Math.ceil(total / itemsPerPage),
    articles,
  });
}

async function getArticle(id) {
  let article = await getItemByKey(tables.articles, `ARTICLE#${id}`, "METADATA");
  if (!article) {
    const candidates = await scanByEntity(tables.articles, "articles");
    article = candidates.find((candidate) => candidate.urltitle === id || candidate.slug === id);
  }

  if (!article) {
    return json(404, {
      status: "error",
      message: "Error al devolver el artículo.",
      errorMessage: "No hay artículo.",
    });
  }

  return json(200, {
    status: "success",
    article: await populateArticle(article),
  });
}

async function filterArticles(articles, params) {
  let filtered = articles;

  if (params.type && params.type !== "all") {
    filtered = filtered.filter((article) =>
      [article.articleCat, article.cat].filter(Boolean).includes(params.type)
    );
  }

  if (params.search) {
    const expression = new RegExp(escapeRegExp(params.search), "i");
    const populated = await Promise.all(filtered.map(populateArticle));
    filtered = populated.filter((article) => articleMatchesSearch(article, expression, params.rootAccess));
  }

  return filtered;
}

function articleMatchesSearch(article, expression, rootAccess) {
  const values = [
    article.title,
    article.titleEng,
    article.subtitle,
    article.subtitleEng,
    article.intro,
    article.introEng,
    article.outro,
    article.outroEng,
    article.tags,
    article.urltitle,
    article.cat?.title,
    article.cat?.titleEng,
    article.articleCat?.title,
    article.articleCat?.titleEng,
  ];

  if (rootAccess === "all" || rootAccess.includes("insertion")) {
    values.push(...asArray(article.insertions));
  }
  if (rootAccess === "all" || rootAccess.includes("subCat")) {
    for (const subcategory of asArray(article.subCats)) {
      values.push(subcategory.title, subcategory.titleEng);
    }
  }
  if (rootAccess === "all" || rootAccess.includes("section")) {
    for (const section of asArray(article.sections)) {
      values.push(section.title, section.titleEng, section.text, section.textEng);
      values.push(...asArray(section.insertions));
    }
  }
  values.push(...asArray(article.langs));

  return values.some((value) => value !== undefined && expression.test(String(value)));
}

async function populateArticle(article) {
  const { categoriesById, subcategoriesById } = await loadArticleCategoryGraph();
  const articleCopy = { ...article };

  const categoryId = articleCopy.cat || articleCopy.articleCat;
  if (categoryId && categoriesById.has(categoryId)) {
    const category = categoryWithSubcats(categoriesById.get(categoryId), subcategoriesById);
    articleCopy.cat = category;
    if (articleCopy.articleCat) {
      articleCopy.articleCat = category;
    }
  }

  articleCopy.subCats = resolveReferenceList(articleCopy.subCats, subcategoriesById);
  articleCopy.sections = await loadArticleSections(articleCopy);
  return articleCopy;
}

async function loadArticleSections(article) {
  const byArticlePk = article._id ? await queryByPk(tables.articleSections, `ARTICLE#${article._id}`) : [];
  const requestedIds = asArray(article.sections);
  let sections = byArticlePk;

  if (sections.length === 0 && requestedIds.length > 0) {
    const allSections = await scanByEntity(tables.articleSections, "articlesections");
    const sectionMap = byId(allSections);
    sections = resolveReferenceList(requestedIds, sectionMap).filter((value) => typeof value === "object");
  }

  const sectionOrder = new Map(requestedIds.map((id, index) => [id, index]));
  const sortedSections = sections.sort((left, right) => {
    const leftIndex = sectionOrder.get(left._id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = sectionOrder.get(right._id) ?? Number.MAX_SAFE_INTEGER;
    return leftIndex - rightIndex || compareValues(left.order, right.order);
  });

  return populateFileFieldsForDocs(sortedSections, ["principalFile", "files"]);
}

async function loadArticleCategoryGraph() {
  const [categories, subcategories] = await Promise.all([
    queryByEntity(tables.articleCategories, "ARTICLECAT#ALL"),
    scanByEntity(tables.articleCategories, "articlesubcats"),
  ]);
  const categoriesById = byId(categories);
  const subcategoriesById = byId(subcategories);
  return {
    categories,
    categoriesById,
    subcategories,
    subcategoriesById,
  };
}

function categoryWithSubcats(category, subcategoriesById) {
  if (!category) {
    return category;
  }

  return {
    ...category,
    subcats: resolveReferenceList(category.subcats, subcategoriesById),
  };
}

function subcategoryWithCategory(subcategory, categoriesById, subcategoriesById) {
  const category = categoryWithSubcats(categoriesById.get(subcategory.cat), subcategoriesById);
  return {
    ...subcategory,
    cat: category || subcategory.cat,
  };
}

async function listMainCollection(collection) {
  return queryByEntity(tables.main, `MAIN#${collection}`);
}

async function populateFileFieldsForDocs(docs, fields) {
  const fileIds = unique(
    docs.flatMap((doc) => fields.flatMap((field) => asArray(doc[field]).filter(isLegacyObjectId)))
  );
  const filesById = await getFilesByIds(fileIds);

  return docs.map((doc) => {
    const copy = { ...doc };
    for (const field of fields) {
      if (Array.isArray(copy[field])) {
        copy[field] = copy[field].map((id) => filesById.get(id) || id);
      } else if (copy[field]) {
        copy[field] = filesById.get(copy[field]) || copy[field];
      }
    }
    return copy;
  });
}

async function getFileById(id, options = {}) {
  if (!id) {
    return undefined;
  }
  return getItemByKey(tables.files, `FILE#${id}`, "METADATA", options);
}

async function getFilesByIds(ids) {
  if (ids.length === 0) {
    return new Map();
  }

  const result = new Map();
  for (let index = 0; index < ids.length; index += 100) {
    const batchIds = ids.slice(index, index + 100);
    let requestItems = {
      [tables.files]: {
        Keys: batchIds.map((id) => ({
          pk: { S: `FILE#${id}` },
          sk: { S: "METADATA" },
        })),
      },
    };

    do {
      const response = await client.send(new BatchGetItemCommand({ RequestItems: requestItems }));
      for (const item of response.Responses?.[tables.files] || []) {
        const file = toPublicDocument(item);
        result.set(file._id, file);
      }
      requestItems = response.UnprocessedKeys;
    } while (requestItems && Object.keys(requestItems).length > 0);
  }

  return result;
}

async function getItemByKey(tableName, pk, sk, options = {}) {
  assertTable(tableName);
  const response = await client.send(
    new GetItemCommand({
      TableName: tableName,
      Key: {
        pk: { S: pk },
        sk: { S: sk },
      },
    })
  );
  return response.Item ? toPublicDocument(response.Item, options) : undefined;
}

async function queryByPk(tableName, pk) {
  assertTable(tableName);
  return queryAll({
    TableName: tableName,
    KeyConditionExpression: "#pk = :pk",
    ExpressionAttributeNames: {
      "#pk": "pk",
    },
    ExpressionAttributeValues: {
      ":pk": { S: pk },
    },
  });
}

async function queryByEntity(tableName, entityPk) {
  assertTable(tableName);
  return queryAll({
    TableName: tableName,
    IndexName: entityIndexName,
    KeyConditionExpression: "#gsi1pk = :gsi1pk",
    ExpressionAttributeNames: {
      "#gsi1pk": "gsi1pk",
    },
    ExpressionAttributeValues: {
      ":gsi1pk": { S: entityPk },
    },
  });
}

async function queryAll(input) {
  const items = [];
  let exclusiveStartKey;
  do {
    const response = await client.send(
      new QueryCommand({
        ...input,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...(response.Items || []).map(toPublicDocument));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

async function scanByEntity(tableName, entityType) {
  assertTable(tableName);
  const items = [];
  let exclusiveStartKey;
  do {
    const response = await client.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "#entityType = :entityType",
        ExpressionAttributeNames: {
          "#entityType": "entityType",
        },
        ExpressionAttributeValues: {
          ":entityType": { S: entityType },
        },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...(response.Items || []).map(toPublicDocument));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

function toPublicDocument(item, options = {}) {
  const document = unmarshall(item);
  const publicDocument = JSON.parse(JSON.stringify(document));
  if (document.legacyMongoId) {
    publicDocument._id = document.legacyMongoId;
  }

  for (const internalField of [
    "pk",
    "sk",
    "gsi1pk",
    "gsi1sk",
    "collection",
    "entityType",
    "legacyMongoId",
    "migrationBatchId",
  ]) {
    delete publicDocument[internalField];
  }

  if (document.entityType === "files" && !options.exposeRawS3Location) {
    delete publicDocument.location;
    delete publicDocument.s3Url;
  }

  return publicDocument;
}

function parseArticleListPath(pathname) {
  const parts = pathname.replace(/^\/api\/article\/articles\/?/, "").split("/").filter(Boolean);
  return {
    page: parsePositiveInteger(parts[0], 1),
    itemsPerPage: parseNonNegativeInteger(parts[1], 0),
    sort: safeDecode(parts[2] || "-create_at"),
    rootAccess: safeDecode(parts[3] || "all"),
    type: safeDecode(parts[4] || "all"),
    search: parts[5] ? safeDecode(parts.slice(5).join("/")) : undefined,
  };
}

function paginate(items, params) {
  if (!params.itemsPerPage) {
    return items;
  }
  const start = Math.max(params.page - 1, 0) * params.itemsPerPage;
  return items.slice(start, start + params.itemsPerPage);
}

function sortDocuments(items, sortSpec) {
  const descending = sortSpec.startsWith("-");
  const field = descending ? sortSpec.slice(1) : sortSpec;
  return [...items].sort((left, right) => {
    const result = compareValues(left[field], right[field]);
    return descending ? -result : result;
  });
}

function compareValues(left, right) {
  if (left === right) {
    return 0;
  }
  if (left === undefined || left === null) {
    return 1;
  }
  if (right === undefined || right === null) {
    return -1;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function resolveReferenceList(value, lookup) {
  return asArray(value).map((id) => lookup.get(id) || id);
}

function byId(items) {
  return new Map(items.filter((item) => item._id).map((item) => [item._id, item]));
}

function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isLegacyObjectId(value) {
  return typeof value === "string" && /^[0-9a-fA-F]{24}$/.test(value);
}

function parsePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildCdnUrl(s3Key) {
  if (!s3Key || !process.env.ASSETS_DOMAIN) {
    return undefined;
  }
  return `https://${process.env.ASSETS_DOMAIN}/${encodeURI(s3Key).replace(/%2F/g, "/")}`;
}

function firstAllowedFileRedirectUrl(candidates) {
  return candidates.find(isAllowedFileRedirectUrl);
}

function isAllowedFileRedirectUrl(candidate) {
  if (!candidate || typeof candidate !== "string") {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch (_error) {
    return false;
  }

  if (parsed.protocol !== "https:") {
    return false;
  }

  const allowedHosts = new Set();
  if (process.env.ASSETS_DOMAIN) {
    allowedHosts.add(process.env.ASSETS_DOMAIN.toLowerCase());
  }
  if (process.env.ASSETS_BUCKET) {
    const bucket = process.env.ASSETS_BUCKET.toLowerCase();
    const region = (process.env.AWS_REGION || "us-east-1").toLowerCase();
    allowedHosts.add(`${bucket}.s3.${region}.amazonaws.com`);
    allowedHosts.add(`${bucket}.s3.amazonaws.com`);
  }

  return allowedHosts.has(parsed.hostname.toLowerCase());
}

function normalizePath(pathname) {
  if (!pathname || pathname === "/") {
    return "/";
  }
  const normalized = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return normalized || "/";
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertTable(tableName) {
  if (!tableName) {
    throw new Error("Missing DynamoDB table configuration.");
  }
}

function setDynamoClientForTest(testClient) {
  client = testClient;
}

function resetDynamoClientForTest() {
  client = new DynamoDBClient({});
}

function empty(statusCode) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: "",
  };
}

function redirect(location) {
  return {
    statusCode: 302,
    headers: {
      ...corsHeaders(),
      location,
    },
    body: "",
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  };
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,HEAD,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
  };
}

exports.__test = {
  setDynamoClientForTest,
  resetDynamoClientForTest,
};
