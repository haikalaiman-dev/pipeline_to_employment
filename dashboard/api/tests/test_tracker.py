import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from dashboard.api import paths, state, tracker

LEGACY_CSV = (
    "date,company,sector,role,role_type,channel,status,contact_person,fit_rating,notes,cv_file,cover_letter_file,source,extra\n"
    "2026-09-01,Acme,Tech,Data Analyst,,portal,drafted,,72,first,cv/main_acme_analyst.tex,cover_letters/cover_acme_analyst.tex,https://x/1,keep\n"
    "2026-08-01,Beta,Tech,Engineer,,portal,no response,,60,,,,,\n"
)


class Tracker(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.csv = Path(self.tmp.name) / "job_search_tracker.csv"
        self.csv.write_text(LEGACY_CSV, encoding="utf-8")
        self.patch = mock.patch.object(paths, "TRACKER", self.csv)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def test_leaving_drafted_sets_date_and_appends_note_only(self):
        row = tracker.set_status(0, "applied", note="submitted", when=date(2026, 9, 12))
        self.assertEqual(row["status"], "applied")
        self.assertEqual(row["date"], "2026-09-12")
        self.assertEqual(row["notes"], "first; submitted 2026-09-12")
        text = self.csv.read_text(encoding="utf-8")
        self.assertTrue(text.splitlines()[0].endswith(",extra,deadline"))  # legacy header gets deadline
        self.assertIn(",keep,", text)  # unknown column preserved
        self.assertIn("no response", text)  # other rows untouched byte-for-byte

    def test_non_drafted_keeps_date(self):
        tracker.set_status(0, "applied", when=date(2026, 9, 12))
        row = tracker.set_status(0, "interview", when=date(2026, 9, 20))
        self.assertEqual(row["date"], "2026-09-12")

    def test_rejects_unknown_and_legacy_spellings_on_write(self):
        with self.assertRaises(ValueError):
            tracker.set_status(0, "no response")
        with self.assertRaises(ValueError):
            tracker.set_status(0, "ghosted")
        with self.assertRaises(IndexError):
            tracker.set_status(9, "applied")

    def test_legacy_spelling_reads_as_final(self):
        rows = state.read_tracker()
        self.assertEqual(rows[1]["status"], "no_response")
        apps = state.list_applications("final")
        self.assertEqual([a["company"] for a in apps], ["Beta"])
        self.assertEqual(state.list_applications("open")[0]["slug"], "acme_data_analyst")


class ArchiveSlug(unittest.TestCase):
    def test_rule(self):
        self.assertEqual(state.archive_slug("Novo Nordisk A/S", "ML Engineer"), "novo_nordisk_as_ml_engineer")
        self.assertEqual(state.archive_slug("Ops Consulting, LLC", "Malware  Analyst"), "ops_consulting_llc_malware_analyst")


if __name__ == "__main__":
    unittest.main()
