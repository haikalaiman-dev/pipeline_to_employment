import json
import unittest

from dashboard.api import claude_runner

LINES = [
    {"type": "system", "subtype": "init", "session_id": "abcdef123456", "model": "claude-opus-5"},
    {"type": "assistant", "message": {"content": [
        {"type": "text", "text": "Scoring 3 postings."},
        {"type": "tool_use", "name": "Bash", "input": {"command": "python3 tools/rank_state.py candidates"}}]}},
    {"type": "user", "message": {"content": [{"type": "tool_result", "content": [{"type": "text", "text": "{\"eligible\": 3}"}]}]},
     "parent_tool_use_id": "toolu_1"},
    {"type": "result", "subtype": "success", "num_turns": 12, "total_cost_usd": 0.42, "result": "RESULT: {}"},
]


class ParseEvent(unittest.TestCase):
    def test_summaries(self):
        evs = [claude_runner.parse_event(json.dumps(l)) for l in LINES]
        self.assertIn("session abcdef12", evs[0]["summary"])
        self.assertIn("Scoring 3 postings.", evs[1]["summary"])
        self.assertIn("Bash: {\"command\"", evs[1]["summary"])
        self.assertTrue(evs[2]["summary"].startswith("result: "))
        self.assertTrue(evs[2]["subagent"])
        self.assertEqual(evs[3]["summary"], "success turns=12 cost=$0.42")

    def test_non_json_is_none(self):
        self.assertIsNone(claude_runner.parse_event("not json"))


class BuildCmd(unittest.TestCase):
    def test_rank_and_apply_prompts(self):
        cmd = claude_runner.build_cmd("rank", {"limit": 5, "all": True, "focus": "remote"})
        self.assertEqual(cmd[:3], ["claude", "-p", "/rank --limit 5 --all remote"])
        for flag in ("--output-format", "--verbose", "--permission-mode", "--max-budget-usd",
                     "--append-system-prompt", "--setting-sources"):
            self.assertIn(flag, cmd)
        self.assertNotIn("--max-turns", cmd)  # not supported by claude 2.1.x
        self.assertEqual(claude_runner.prompt_for("apply-docs", {"url": "https://x/1"}), "/apply https://x/1")
        p = claude_runner.prompt_for("interview", {"company": "Acme", "role": "Analyst", "stage": "technical", "date": "2026-10-01"})
        self.assertTrue(p.startswith("/interview Acme Analyst\n\nInterview details: stage=technical, date=2026-10-01."))
        self.assertIn("Do not ask", claude_runner.prompt_for("outcome-run", {"company": "Acme", "status": "rejected"}))


if __name__ == "__main__":
    unittest.main()
