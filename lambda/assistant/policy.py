import json
import re


SLUG = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$")


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
    if any(type(i) is not int or not 1 <= i <= len(sources) for i in ids):
        return None
    return text.strip(), list(dict.fromkeys(sources[i - 1]["slug"] for i in ids))


def reserve_microusd():
    # Conservative upper allowance for inference, retrieval and content/PII filters.
    return 4000
