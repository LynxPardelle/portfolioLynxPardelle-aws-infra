# API Contract Inventory

Generated: 2026-06-18 Central Time

## Scope and Evidence

This inventory is based on source files in `C:\Users\lince\Documents\GitHub\portfolioLynxPardelle`:

- `app.js`
- `routes/main.js`
- `routes/article.js`
- `routes/performance.js`
- `routes/canary.js`
- `routes/monitoring.js`
- `routes/rollback.js`
- `controllers/main.js`
- `controllers/article.js`
- `middlewares/authenticated.js`
- `middlewares/is_admin.js`
- `services/jwt.js`
- `models/*.js`

The live endpoint `https://api.lynxpardelle.com/health` timed out during planning, so the route contract must be validated from code, local execution, MongoDB backup fixtures, and S3 metadata. Do not use the live endpoint as the parity oracle.

## Mounted Surfaces

`app.js` mounts:

- `GET /`
- `GET /health`
- `/api/main`
- `/api/article`
- `/api/performance`
- `/api/canary` when the route import succeeds
- `/api/monitoring` when the route import succeeds
- `/api/rollback` when the route import succeeds

## Root and Health

| Method | Route | Auth | Source | Response shape |
| --- | --- | --- | --- | --- |
| GET | `/` | Public | `app.js` | `200` with `{ author, url }`. |
| GET | `/health` | Public | `app.js` | `200` with `{ status, app, timestamp, storage }`; `500` with `{ status, app, timestamp, error }` on health handler error. |

## Main Routes

Base path: `/api/main`

| Method | Route | Auth | Controller | Request params/body | Success shape |
| --- | --- | --- | --- | --- | --- |
| GET | `/datos-autor` | Public | `datosAutor` | none | `{ autor, url }` |
| POST | `/album` | Admin JWT + `ROLE_ADMIN` | `createAlbum` | body: `title`, optional `img`, `spotify`, `tidal` | `{ status: "success", album }` |
| POST | `/book-img` | Admin JWT + `ROLE_ADMIN` | `createBookImg` | body follows `BookImg` model | `{ status: "success", bookImg }` |
| POST | `/cv-section` | Admin JWT + `ROLE_ADMIN` | `createCVSection` | body follows `CVSection` model | `{ status: "success", cvSection }` |
| POST | `/cv-sub-section` | Admin JWT + `ROLE_ADMIN` | `createCVSubSection` | body follows `CVSubSection` model | `{ status: "success", cvSubSection }` |
| POST | `/song` | Admin JWT + `ROLE_ADMIN` | `createSong` | body follows `Song` model | `{ status: "success", song }` |
| POST | `/video` | Admin JWT + `ROLE_ADMIN` | `createVideo` | body follows `Video` model | `{ status: "success", video }` |
| POST | `/web-site` | Admin JWT + `ROLE_ADMIN` | `createWebsite` | body follows `Website` model | `{ status: "success", website }` |
| GET | `/albums` | Public | `getAlbums` | none | `{ status: "success", albums }` |
| GET | `/book-imgs` | Public | `getBookImgs` | none | `{ status: "success", bookImgs }` |
| GET | `/cv-sections` | Public | `getCVSections` | none | `{ status: "success", cvSections }` |
| GET | `/main` | Public | `getMain` | none | `{ status: "success", main }` |
| GET | `/songs` | Public | `getSongs` | none | `{ status: "success", songs }` |
| GET | `/videos` | Public | `getVideos` | none | `{ status: "success", videos }` |
| GET | `/web-sites` | Public | `getWebsites` | none | `{ status: "success", websites }` |
| POST | `/login` | Public | `login` | body: `email`, `password`, optional `gettoken` | `{ token }` when `gettoken` is truthy, otherwise `{ status: "Success", user }` |
| PUT | `/album/:id` | Admin JWT + `ROLE_ADMIN` | `updateAlbum` | param `id`, body update | `{ status: "success", album }` or equivalent updated object shape from controller |
| PUT | `/book-img/:id` | Admin JWT + `ROLE_ADMIN` | `updateBookImg` | param `id`, body update | updated `bookImg` response |
| PUT | `/cv-section/:id` | Admin JWT + `ROLE_ADMIN` | `updateCVSection` | param `id`, body update | updated `cvSection` response |
| PUT | `/cv-sub-section/:id` | Admin JWT + `ROLE_ADMIN` | `updateCVSubSection` | param `id`, body update | updated `cvSubSection` response |
| PUT | `/main` | Admin JWT + `ROLE_ADMIN` | `updateMain` | body update; key changes use `keyOld`/`key` | updated `main` response |
| PUT | `/song/:id` | Admin JWT + `ROLE_ADMIN` | `updateSong` | param `id`, body update | updated `song` response |
| PUT | `/video/:id` | Admin JWT + `ROLE_ADMIN` | `updateVideo` | param `id`, body update | updated `video` response |
| PUT | `/web-site/:id` | Admin JWT + `ROLE_ADMIN` | `updateWebsite` | param `id`, body update | updated `website` response |
| DELETE | `/album/:id` | Admin JWT + `ROLE_ADMIN` | `deleteAlbum` | param `id` | deleted `album` response |
| DELETE | `/book-img/:id` | Admin JWT + `ROLE_ADMIN` | `deleteBookImg` | param `id` | deleted `bookImg` response |
| DELETE | `/cv-section/:id` | Admin JWT + `ROLE_ADMIN` | `deleteCVSection` | param `id` | deleted `cvSection` response |
| DELETE | `/cv-sub-section/:id` | Admin JWT + `ROLE_ADMIN` | `deleteCVSubSection` | param `id` | deleted `cvSubSection` response |
| DELETE | `/song/:id` | Admin JWT + `ROLE_ADMIN` | `deleteSong` | param `id` | deleted `song` response |
| DELETE | `/video/:id` | Admin JWT + `ROLE_ADMIN` | `deleteVideo` | param `id` | deleted `video` response |
| DELETE | `/web-site/:id` | Admin JWT + `ROLE_ADMIN` | `deleteWebsite` | param `id` | deleted `website` response |
| POST | `/upload-file-album/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFileAlbum` | param `id`, multipart files | updated album/file response; uses S3 helpers |
| POST | `/upload-file-book-img/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFileBookImg` | param `id`, multipart file | updated book image/file response; validates image extension |
| POST | `/upload-file-main/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFileMain` | param `id` identifies main file option | updated main response |
| POST | `/upload-file-song/:id/:option` | Admin JWT + `ROLE_ADMIN` | `UploadFileSong` | params `id`, `option` (`song` or `coverArt`) | updated song response |
| POST | `/upload-file-video/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFileVideo` | param `id`, multipart file | updated video response |
| POST | `/upload-file-web-site/:id/:option` | Admin JWT + `ROLE_ADMIN` | `UploadFileWebsite` | params `id`, `option` (`desktopImg`, `tabletImg`, `mobileImg`) | updated website response |
| GET | `/get-file/:id` | Public | `getFile` | param `id` | redirects/sends S3/CDN file data or error shape |
| GET | `/file-info/:id` | Public | `getFileInfo` | param `id` | file metadata plus generated CDN URL when available |
| GET | `/s3-status` | Public | inline route | none | `{ success, s3Configured, cloudfrontConfigured, storageMode, timestamp }` |

## Article Routes

Base path: `/api/article`

| Method | Route | Auth | Controller | Request params/body | Success shape |
| --- | --- | --- | --- | --- | --- |
| GET | `/datos-autor` | Public | `datosAutor` | none | `{ autor, url }` |
| POST | `/article` | Admin JWT + `ROLE_ADMIN` | `createArticle` | body follows `Article` model; `urltitle` is validated | `{ status: "success", article }` |
| POST | `/articleSection` | Admin JWT + `ROLE_ADMIN` | `createArticleSection` | body follows `ArticleSection` model; `article` required | `{ status: "success", articleSection }` |
| POST | `/articleCat` | Admin JWT + `ROLE_ADMIN` | `createArticleCat` | body follows `ArticleCat` model | `{ status: "success", articleCat }` |
| POST | `/articleSubCat` | Admin JWT + `ROLE_ADMIN` | `createArticleSubCat` | body follows `ArticleSubCat` model | `{ status: "success", articleSubCat }` |
| GET | `/article/:id` | Public | `getArticle` | param `id` | `{ status: "success", article }` |
| GET | `/article-cats` | Public | `getArticlesCats` | none | `{ status: "success", articleCats }` |
| GET | `/article-sub-cats` | Public | `getArticlesSubCats` | none | `{ status: "success", articleSubCats }` |
| GET | `/articles/:page?/:ipp?/:sort?/:rootAccess?/:type?/:search?` | Public | `getArticles` | optional path params for paging, sort, access, type, search | `{ status: "success", total_items, pages, articles }` |
| PUT | `/article/:id` | Admin JWT + `ROLE_ADMIN` | `updateArticle` | param `id`, body update | updated `article` response |
| PUT | `/article-cat/:id` | Admin JWT + `ROLE_ADMIN` | `updateArticleCat` | param `id`, body update | updated `articleCat` response |
| PUT | `/article-sub-cat/:id` | Admin JWT + `ROLE_ADMIN` | `updateArticleSubCat` | param `id`, body update | updated `articleSubCat` response |
| PUT | `/article-section/:id` | Admin JWT + `ROLE_ADMIN` | `updateArticleSection` | param `id`, body update | updated `articleSection` response |
| DELETE | `/article/:id` | Public in route file | `deleteArticle` | param `id` | deleted article response |
| DELETE | `/articleSection/:id` | Public in route file | `deleteArticleSection` | param `id` | deleted article section response |
| DELETE | `/articleCat/:id` | Public in route file | `deleteArticleCat` | param `id` | deleted category response |
| DELETE | `/articleSubCat/:id` | Public in route file | `deleteArticleSubCat` | param `id` | deleted subcategory response |
| POST | `/upload-file-article/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFileArticle` | param `id`, multipart file | updated article cover/file response |
| POST | `/upload-file-articleSection/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFileArticleSectionPrincipalFile` | param `id`, multipart file | updated section principal file response |
| POST | `/upload-files-articleSection/:id` | Admin JWT + `ROLE_ADMIN` | `UploadFilesArticleSection` | param `id`, multipart files | updated section files response |

Security note: the article delete routes do not include `ensureAuth` or `isAdmin` middleware in `routes/article.js`. Treat that as source behavior to fix or intentionally preserve by decision before production.

## Operations Routes

The current app includes `/api/performance`, `/api/canary`, `/api/monitoring`, and `/api/rollback`. These routes are coupled to old deployment and monitoring workflows. Rebuild only the useful serverless operations equivalents.

Known route names from source:

- `/api/performance/dashboard`
- `/api/performance/metrics/current`
- `/api/performance/metrics/history`
- `/api/performance/alerts`
- `/api/performance/thresholds`
- `/api/performance/collect`
- `/api/performance/export`
- `/api/performance/health`
- `/api/performance/start`
- `/api/performance/stop`
- `/api/canary/status`
- `/api/canary/validate`
- `/api/canary/start`
- `/api/canary/rollback`
- `/api/canary/health`
- `/api/canary/metrics`
- `/api/canary/report`
- `/api/canary/stage/next`
- `/api/canary/pause`
- `/api/canary/resume`
- `/api/canary/dashboard`
- `/api/canary/config`
- `/api/canary/logs`
- `/api/monitoring/status`
- `/api/monitoring/start`
- `/api/monitoring/stop`
- `/api/monitoring/dashboard`
- `/api/monitoring/metrics`
- `/api/monitoring/incidents`
- `/api/monitoring/incidents/:id/resolve`
- `/api/monitoring/escalate`
- `/api/monitoring/health`
- `/api/monitoring/pause`
- `/api/monitoring/resume`
- `/api/monitoring/report`
- `/api/monitoring/logs`
- `/api/monitoring/test-alert`
- `/api/rollback/status`
- `/api/rollback/trigger`
- `/api/rollback/monitoring/start`
- `/api/rollback/monitoring/stop`
- `/api/rollback/triggers`
- `/api/rollback/timeline`
- `/api/rollback/communications`
- `/api/rollback/communicate`
- `/api/rollback/health`
- `/api/rollback/report`
- `/api/rollback/test-trigger`
- `/api/rollback/metrics`
- `/api/rollback/validate`
- `/api/rollback/dashboard`

## Auth Contract

Current auth uses:

- `middlewares/authenticated.js`
- `middlewares/is_admin.js`
- `services/jwt.js`

Observed source behavior:

- Missing `Authorization` header returns `403` with `{ message: "La petición no tiene la cabecera de autenticación." }`.
- Expired token returns `401` with `{ message: "El token ha expirado" }`.
- Invalid token returns `404` with `{ message: "El token no es válido" }`.
- Missing `JWT_SECRET` returns `500`.
- `isAdmin` returns `200` with `{ message: " No tienes acceso a esta zona" }` when `req.user.role` is not `ROLE_ADMIN`.
- `POST /api/main/login` accepts only `lynxpardelle@lynxpardelle.com`; password is compared against `Main.key` with bcrypt.

Important implementation note: `services/jwt.js` sets `exp` to `moment().add(30, "days").unix` instead of invoking `unix()`. Confirm current runtime token behavior before preserving that bug.

## Mongoose Models and Target Collections

| Model | Fields and references |
| --- | --- |
| `Album` | `title`, `img -> File`, `spotify`, `tidal`, unique `order` |
| `Article` | `title`, `titleEng`, `subtitle`, `subtitleEng`, `insertions`, `cat -> ArticleCat`, `subCats -> ArticleSubCat[]`, `intro`, `introEng`, `outro`, `outroEng`, `sections -> ArticleSection[]`, `tags`, `urltitle`, `coverImg -> File[]`, colors, `langs`, `show`, `create_at` |
| `ArticleCat` | titles, colors, `buttonColor`, `subcats -> ArticleSubCat[]`, `show`, `create_at` |
| `ArticleSection` | titles, text, `article -> Article`, `principalFile -> File`, `files -> File[]`, `order`, colors, `show`, `insertions` |
| `ArticleSubCat` | titles, colors, `buttonColor`, `cat -> ArticleCat`, `show`, `create_at` |
| `BookImg` | `title`, `titleEng`, `img -> File`, unique `order` |
| `CVSection` | titles, text, `CVSubSections -> CVSubSection[]`, unique `order`, colors, `insertions` |
| `CVSubSection` | titles, text, `CVSection -> CVSection`, unique `order`, colors, `insertions` |
| `File` | title fields, `location`, `s3Key`, `cdnUrl`, `size`, `type`, `checksums`, `metadata`, timestamps |
| `Main` | welcome fields, file refs for logo/background/CV, CV text, `key`, `keyOld`, error messages, SEO fields |
| `Song` | `title`, `song -> File`, `duration`, `coverArt -> File`, `link`, unique `order` |
| `Video` | `title`, `titleEng`, `link`, `insert`, `video -> File`, unique `order` |
| `Website` | titles, type fields, descriptions, `link`, `insert`, desktop/tablet/mobile image refs, unique `order` |

## Serverless Rebuild Notes

- Preserve public route compatibility first.
- Preserve legacy ids as strings and store `legacyMongoId` while validating references.
- Prefer DynamoDB access patterns based on route families instead of MongoDB-style ad hoc population.
- Prefer presigned S3 uploads for new media flow, but keep old multipart routes as compatibility wrappers if the frontend still calls them.
- Do not recreate obsolete EC2 rollback behavior in `/api/rollback/*`.
