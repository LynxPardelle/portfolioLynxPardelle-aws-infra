"use strict";

const testLabels = new Set(["test", "prueba"]);

function isTestArticle(article) {
  const category = article.editorial?.category || article.category || article.cat || article.articleCat;
  const tags = [article.editorial?.tags, article.tags].flat().filter((tag) => typeof tag === "string");
  return testLabels.has(String(category?.slug || category?.title || category || "").trim().toLowerCase()) ||
    tags.some((tag) => tag.toLowerCase().split(/[,;\s#]+/).some((value) => testLabels.has(value)));
}

function isPublicArticle(article) {
  return article.show !== false && !isTestArticle(article);
}

module.exports = { isPublicArticle, isTestArticle };
