import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from dashboard.api import paths, runs


class EventsTail(unittest.TestCase):
    def test_streams_existing_lines_then_ends_when_terminal(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(paths, "RUNS", Path(d)):
            rid = "r1"
            (Path(d) / f"{rid}.json").write_text(json.dumps({"id": rid, "kind": "scrape", "state": "succeeded"}))
            log = Path(d) / f"{rid}.jsonl"
            log.write_text('{"type":"status","state":"queued"}\n{"type":"summary","text":"héllo"}\n{"type":"status","state":"succ')

            async def collect():
                return [item async for item in runs.events(rid, after=1)]

            got = asyncio.run(collect())
            # line 1 skipped by `after`, partial third line not emitted
            self.assertEqual(got, [(2, '{"type":"summary","text":"héllo"}')])

    def test_waits_while_running_and_picks_up_new_lines(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(paths, "RUNS", Path(d)):
            rid = "r2"
            meta = Path(d) / f"{rid}.json"
            meta.write_text(json.dumps({"id": rid, "state": "running"}))
            log = Path(d) / f"{rid}.jsonl"
            log.write_text('{"n":1}\n')

            async def scenario():
                gen = runs.events(rid)
                first = await gen.__anext__()
                with log.open("a") as fh:
                    fh.write('{"n":2}\n')
                meta.write_text(json.dumps({"id": rid, "state": "failed"}))
                rest = [item async for item in gen]
                return first, rest

            first, rest = asyncio.run(scenario())
            self.assertEqual(first, (1, '{"n":1}'))
            self.assertEqual(rest, [(2, '{"n":2}')])


if __name__ == "__main__":
    unittest.main()
