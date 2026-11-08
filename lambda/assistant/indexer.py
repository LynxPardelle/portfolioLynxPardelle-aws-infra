import hashlib
import json
import os
from html.parser import HTMLParser

import boto3
from botocore.exceptions import ClientError

from policy import SLUG

s3 = boto3.client("s3")
bedrock = boto3.client("bedrock-agent")
dynamo = boto3.resource("dynamodb")
articles = dynamo.Table(os.environ["ARTICLES_TABLE"])
sections = dynamo.Table(os.environ["SECTIONS_TABLE"])
bucket = os.environ["SOURCE_BUCKET"]
state_key = "index-state.json"


class ArticleText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, _attributes):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1

    def handle_data(self, value):
        if not self.skip:
            self.parts.append(value)


def plain(html):
    parser = ArticleText()
    parser.feed(str(html or ""))
    parser.close()
    return " ".join(" ".join(parser.parts).split())


def get_articles():
    from boto3.dynamodb.conditions import Attr

    options = {"FilterExpression": Attr("entityType").eq("articles"), "ConsistentRead": True}
    while True:
        page = articles.scan(**options)
        yield from (item for item in page.get("Items", []) if item.get("show") is not False)
        if "LastEvaluatedKey" not in page:
            return
        options["ExclusiveStartKey"] = page["LastEvaluatedKey"]


def article_sections(item, article_id):
    from boto3.dynamodb.conditions import Key

    if item.get("editorial"):
        return []
    return sections.query(KeyConditionExpression=Key("pk").eq(f"ARTICLE#{article_id}"), ConsistentRead=True).get("Items", [])


def corpus():
    for item in get_articles():
        article_id = str(item.get("legacyMongoId", ""))
        if not SLUG.fullmatch(article_id):
            continue
        revision = str(item.get("editorial", {}).get("revision", "legacy"))
        parts = article_sections(item, article_id)
        languages = item.get("langs") or ["es", "en"]
        for language, suffix in (("es", ""), ("en", "Eng")):
            if language not in languages and item.get("editorial"):
                continue
            text = "\n\n".join(filter(None, [plain(item.get(f"title{suffix}")), plain(item.get(f"intro{suffix}")),
                       *[plain(section.get(f"text{suffix}")) for section in parts if section.get("show") is not False],
                       plain(item.get(f"outro{suffix}"))]))
            if not text:
                continue
            name = f"published/{article_id}-{language}.txt"
            yield name, text.encode()
            yield name + ".metadata.json", json.dumps({"metadataAttributes": {"slug": article_id, "revision": revision, "lang": language}}).encode()


def handler(_event, _context):
    job_config = {"knowledgeBaseId": os.environ["KNOWLEDGE_BASE_ID"], "dataSourceId": os.environ["SOURCE_ID"]}
    try:
        state = json.load(s3.get_object(Bucket=bucket, Key=state_key)["Body"])
    except ClientError as error:
        if error.response["Error"]["Code"] not in ("NoSuchKey", "404"):
            raise
        state = {}
    previous_job = state.get("job")
    if previous_job:
        status = bedrock.get_ingestion_job(**job_config, ingestionJobId=previous_job)["ingestionJob"]["status"]
        if status in ("STARTING", "IN_PROGRESS", "STOPPING"):
            return
    else:
        status = "COMPLETE"

    previous = state.get("hashes", {})
    current = {}
    for key, content in corpus():
        checksum = hashlib.sha256(content).hexdigest()
        current[key] = checksum
        if previous.get(key) != checksum:
            s3.put_object(Bucket=bucket, Key=key, Body=content,
                          ContentType="application/json" if key.endswith(".json") else "text/plain; charset=utf-8")
    for key in previous.keys() - current.keys():
        s3.delete_object(Bucket=bucket, Key=key)
    if current != previous or (previous_job and status != "COMPLETE"):
        job = bedrock.start_ingestion_job(**job_config)["ingestionJob"]["ingestionJobId"]
        s3.put_object(Bucket=bucket, Key=state_key, Body=json.dumps({"job": job, "hashes": current}), ContentType="application/json")
