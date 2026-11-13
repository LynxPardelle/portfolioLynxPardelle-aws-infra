import base64
import json
import re


SLUG = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$")


def is_public_article(article):
    editorial = article.get("editorial") or {}
    category = editorial.get("category") or article.get("category") or article.get("cat") or article.get("articleCat") or ""
    if isinstance(category, dict):
        category = category.get("slug") or category.get("title") or ""
    tags = []
    for value in (editorial.get("tags"), article.get("tags")):
        tags.extend(value if isinstance(value, list) else [value])
    labels = {"test", "prueba"}
    return (article.get("show") is not False and str(category).strip().lower() not in labels
            and not any(labels.intersection(re.split(r"[,;\s#]+", tag.lower()))
                        for tag in tags if isinstance(tag, str)))


def can_use_editorial_assistant(event):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    if claims.get("token_use") != "access" or not claims.get("sub") or not claims.get("iss"):
        return False
    header = (event.get("headers") or {}).get("authorization") or ""
    token = re.fullmatch(r"Bearer [A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+", header, re.IGNORECASE)
    if not token:
        return False
    # Use the original group array from the bearer token already validated by API Gateway.
    encoded = token.group(1)
    try:
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
    except (ValueError, TypeError):
        return False
    if not isinstance(payload, dict) or payload.get("token_use") != "access":
        return False
    if payload.get("sub") != claims["sub"] or payload.get("iss") != claims["iss"]:
        return False
    groups = payload.get("cognito:groups")
    return isinstance(groups, list) and ("editor" in groups or "admin" in groups)


def eligible_sources(results, revisions, lang):
    sources = []
    for hit in results:
        metadata = hit.get("metadata", {})
        slug = metadata.get("slug", "")
        text = hit.get("content", {}).get("text", "")
        if (isinstance(slug, str) and SLUG.fullmatch(slug) and metadata.get("lang") == lang and slug in revisions
                and revisions[slug] == metadata.get("revision") and hit.get("score", 0) >= .25 and text.strip()):
            sources.append({"slug": slug, "text": text[:700]})
        if len(sources) == 3:
            break
    return sources


def parse_answer(raw, sources):
    if isinstance(raw, str) and (fence := re.fullmatch(r"\s*```(?:json)?\s*(.*?)\s*```\s*", raw, re.DOTALL)):
        raw = fence.group(1)
    try:
        answer = json.loads(raw)
    except (ValueError, TypeError):
        return None
    if not isinstance(answer, dict):
        return None
    text, ids = answer.get("answer"), answer.get("sources")
    if not isinstance(text, str) or not text.strip() or not isinstance(ids, list) or not ids:
        return None
    # Nova can return a numbered citation object even when asked for integers.
    ids = [item.get("number") if isinstance(item, dict) else item for item in ids]
    if any(type(i) is not int or not 1 <= i <= len(sources) for i in ids):
        return None
    return text.strip(), list(dict.fromkeys(sources[i - 1]["slug"] for i in ids))


def reserve_microusd():
    # Conservative upper allowance for inference, retrieval and content/PII filters.
    return 4000
