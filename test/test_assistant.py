import unittest

from policy import can_use_editorial_assistant, eligible_sources, is_public_article, parse_answer, reserve_microusd


class AssistantPolicyTests(unittest.TestCase):
    def test_test_taxonomy_never_enters_the_public_corpus(self):
        self.assertFalse(is_public_article({"show": True, "editorial": {"category": "test"}}))
        self.assertFalse(is_public_article({"show": True, "tags": "Angular, TEST"}))
        self.assertTrue(is_public_article({"show": True, "tags": "testing"}))

    def test_editorial_assistant_requires_an_access_token_with_an_exact_role(self):
        for groups in ("[admin]", "[other, editor]", ["admin"]):
            self.assertTrue(can_use_editorial_assistant({"token_use": "access", "cognito:groups": groups}))
        for groups in ("[analytics.admin]", "[editorial]", None):
            self.assertFalse(can_use_editorial_assistant({"token_use": "access", "cognito:groups": groups}))
        self.assertFalse(can_use_editorial_assistant({"token_use": "id", "cognito:groups": "[admin]"}))

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
