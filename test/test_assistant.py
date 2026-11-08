import unittest

from policy import eligible_sources, parse_answer, reserve_microusd


class AssistantPolicyTests(unittest.TestCase):
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
