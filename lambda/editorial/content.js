"use strict";

const MarkdownIt = require("markdown-it");
const markdown = new MarkdownIt({ html: false, linkify: false });
const categories = new Set(["technology", "art", "other"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function httpsUrl(value) {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function language(value) {
  if (value == null) return undefined;
  if (typeof value.title !== "string" || !value.title.trim() || value.title.length > 160 ||
      typeof value.markdown !== "string" || !value.markdown.trim() || value.markdown.length > 15000) {
    throw new Error("Each language requires a title and Markdown body within the length limits.");
  }
  return { title: value.title.trim(), markdown: value.markdown.trim() };
}

function validateDraft(input, automated = false) {
  if (!input || typeof input.slug !== "string" || input.slug.length > 80 || !slugPattern.test(input.slug)) {
    throw new Error("Use a lowercase slug of up to 80 letters, digits and hyphens.");
  }
  if (!categories.has(input.category)) throw new Error("Invalid category.");
  const es = language(input.es);
  const en = language(input.en);
  const sources = input.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 8 || !sources.every(httpsUrl)) {
    throw new Error("Provide up to eight HTTPS source links.");
  }
  const uniqueSources = [...new Set(sources.map((source) => new URL(source).href))];
  const eventDate = input.eventDate || "";
  if (eventDate && (typeof eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) ||
      !Number.isFinite(Date.parse(eventDate)) || new Date(eventDate).toISOString().slice(0, 10) !== eventDate)) {
    throw new Error("The event date must use YYYY-MM-DD.");
  }
  if (!es && !en) throw new Error("Provide at least one language.");
  if (automated && (input.category !== "technology" || !es || !en || uniqueSources.length < 2 || !eventDate)) {
    throw new Error("Automated drafts require technology, both languages, an event date and two distinct sources.");
  }
  return { slug: input.slug, category: input.category, es, en, sources: uniqueSources, eventDate };
}

function eligibleForAutopublish(draft, now = new Date()) {
  const age = Date.parse(now.toISOString().slice(0, 10)) - Date.parse(draft.eventDate);
  return draft.origin === "desktop" && draft.category === "technology" && age >= 0 && age <= 7 * 86400000;
}

function publicArticle(draft, now) {
  const id = `editorial-${draft.slug}`;
  return {
    pk: `ARTICLE#${id}`, sk: "METADATA", gsi1pk: "ARTICLE#ALL", gsi1sk: `CREATED#${now}`,
    entityType: "articles", collection: "articles", legacyMongoId: id, urltitle: draft.slug,
    title: (draft.es || draft.en).title, titleEng: (draft.en || draft.es).title,
    intro: markdown.render((draft.es || draft.en).markdown),
    introEng: markdown.render((draft.en || draft.es).markdown),
    langs: [draft.es && "es", draft.en && "en"].filter(Boolean),
    editorial: { category: draft.category, sources: draft.sources, eventDate: draft.eventDate,
      revision: draft.version, origin: draft.origin || "manual" },
    create_at: draft.publishedAt || now, show: true, tags: draft.category,
    sections: [], coverImg: [], subCats: [], insertions: [],
  };
}

module.exports = { validateDraft, eligibleForAutopublish, publicArticle, slugPattern };
