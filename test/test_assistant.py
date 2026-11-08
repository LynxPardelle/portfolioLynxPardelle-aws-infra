import base64
import json
import unittest

from policy import can_use_editorial_assistant, eligible_sources, is_public_article, parse_answer, reserve_microusd


class AssistantPolicyTests(unittest.TestCase):
    def test_test_taxonomy_never_enters_the_public_corpus(self):
        self.assertFalse(is_public_article({"show": True, "editorial": {"category": "test"}}))
        self.assertFalse(is_public_article({"show": True, "tags": "Angular, TEST"}))
        self.assertTrue(is_public_article({"show": True, "tags": "testing"}))

    def test_editorial_assistant_requires_an_access_token_with_an_exact_role(self):
        def event(groups, token_use="access", subject="test-user"):
            identity = {"sub": "test-user", "iss": "test-issuer", "token_use": token_use}
            payload = base64.urlsafe_b64encode(json.dumps({**identity, "cognito:groups": groups}).encode()).decode().rstrip("=")
            return {
                "headers": {"authorization": f"Bearer header.{payload}.signature"},
                "requestContext": {"authorizer": {"jwt": {"claims": {**identity, "sub": subject, "cognito:groups": "[admin editor]"}}}},
            }

        self.assertTrue(can_use_editorial_assistant(event(["admin", "editor"])))
        self.assertTrue(can_use_editorial_assistant(event(["editor"])))
        self.assertFalse(can_use_editorial_assistant(event(["analytics,admin"])))
        self.assertFalse(can_use_editorial_assistant(event(["admin"], "id")))
        self.assertFalse(can_use_editorial_assistant(event(["admin"], subject="other-user")))
        self.assertFalse(can_use_editorial_assistant({"headers": event(["admin"])["headers"]}))

    def test_retrieval_rejects_deleted_stale_or_foreign_sources(self):
        results = [
            {"score": .8, "metadata": {"slug": "current", "revision": "2", "lang": "es"}, "content": {"text": "Expected"}},
            {"score": .9, "metadata": {"slug": "current", "revision": "1", "lang": "es"}, "content": {"text": "Stale"}},
            {"score": .9, "metadata": {"slug": "deleted", "revision": "2", "lang": "es"}, "content": {"text": "Deleted"}},
            {"score": .9, "metadata": {"slug": "current", "revision": "2", "lang": "en"}, "content": {"text": "Other language"}},
        ]
        self.assertEqual([source["text"] for source in eligible_sources(results, {"current": "2"}, "es")], ["Expected"])

    def test_answer_cannot_cite_unknown_or_malformed_sources(self):
        sources = [{"slug": "known", "text": "Context"}]
        self.assertIsNone(parse_answer('{"answer":"Claim", "sources":[2]}', sources))
        self.assertIsNone(parse_answer('{"answer":"Claim", "sources":[true]}', sources))
        self.assertIsNone(parse_answer('{"answer":"Claim", "sources":[]}', sources))
        self.assertEqual(parse_answer('{"answer":"Claim", "sources":[1]}', sources)[1], ["known"])

    def test_budget_reservation_includes_guardrail_and_retrieval_margin(self):
        self.assertGreaterEqual(reserve_microusd(), 2800)


if __name__ == "__main__":
    unittest.main()
