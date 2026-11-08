"use strict";

const bilingual = (key, label, kind = "text") => [[key, label + " · ES", kind], [key + "Eng", label + " · EN", kind]];
const order = ["order", "Orden", "number"];
const image = ["img", "Imagen", "media"];
const title = ["title", "Título", "text"];
const link = ["link", "Enlace", "url"];
const embed = ["insert", "URL de inserción (YouTube o Dailymotion)", "embed"];
const collections = Object.freeze({
  mains: { label: "Inicio, perfil y casos", fields: [
    ...bilingual("profileHeadline", "Titular profesional"),
    ...bilingual("profileSummary", "Resumen profesional", "long"),
    ...bilingual("awsIntro", "Introducción del caso AWS", "long"),
    ...bilingual("genaiIntro", "Introducción del caso Gen AI", "long"),
    ["logo", "Logotipo", "media"], ["backgroundImg", "Fondo", "media"],
  ] },
  websites: { label: "Sitios web", fields: [
    ...bilingual("title", "Título"), ...bilingual("type", "Tipo"), ...bilingual("desc", "Descripción", "long"),
    link, embed, order, ["desktopImg", "Imagen de escritorio", "media"],
    ["tabletImg", "Imagen para tableta", "media"], ["mobileImg", "Imagen para móvil", "media"],
  ] },
  bookimgs: { label: "Obras y galería", fields: [...bilingual("title", "Título"), image, order] },
  videos: { label: "Reel y videos", fields: [...bilingual("title", "Título"), link, embed, ["video", "Video", "media"], order] },
  albums: { label: "Álbumes", fields: [title, image, ["spotify", "Spotify", "url"], ["tidal", "Tidal", "url"], order] },
  songs: { label: "Canciones", fields: [
    title, ["song", "Audio", "media"], ["coverArt", "Portada", "media"],
    ["duration", "Duración en segundos", "number"], link, order,
  ] },
});
const mediaId = /^[a-f0-9]{24}$/i;

function changesFor(collection, values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error("Invalid content.");
  const types = new Map(collection.fields.map(([key, , kind]) => [key, kind]));
  return Object.fromEntries(Object.entries(values).map(([key, value]) => {
    const kind = types.get(key);
    if (!kind) throw new Error("This field cannot be edited.");
    if (value === "" || value === null) return [key, null];
    if (kind === "number") {
      if (!Number.isInteger(value) || value < 0 || value > 999999) throw new Error("Enter a whole number between 0 and 999999.");
      return [key, value];
    }
    if (typeof value !== "string" || value.length > (kind === "long" ? 12000 : 600)) throw new Error("Invalid text length.");
    const clean = value.trim();
    if (kind === "media" && !mediaId.test(clean)) throw new Error("Choose a file from the media library.");
    if (kind === "url" || kind === "embed") validateUrl(clean, kind);
    return [key, clean || null];
  }));
}

function validateUrl(value, kind) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Enter an HTTP or HTTPS URL.");
  if (kind !== "embed") return;
  const host = url.hostname.replace(/^www\./, "");
  const permitted = (["youtube.com", "youtube-nocookie.com"].includes(host) && url.pathname.startsWith("/embed/")) ||
    (host === "dailymotion.com" && url.pathname.startsWith("/embed/video/"));
  if (url.protocol !== "https:" || url.port || !permitted) throw new Error("Use a supported HTTPS video embed.");
}

module.exports = { changesFor, collections, mediaId };
