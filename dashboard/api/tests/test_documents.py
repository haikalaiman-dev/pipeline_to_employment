import io
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from dashboard.api import documents, paths


class Documents(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.patches = [mock.patch.object(paths, "REPO", root), mock.patch.object(paths, "DOCS", root / "documents")]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_allowlist_and_convert_hint(self):
        item = documents.save("cv", None, "cv.pdf", io.BytesIO(b"%PDF"))
        self.assertEqual(item["name"], "cv.pdf")
        self.assertEqual(item["path"], "documents/cv/cv.pdf")
        with self.assertRaises(documents.DocError) as cm:
            documents.save("cv", None, "cv.docx", io.BytesIO(b"x"))
        self.assertEqual(cm.exception.code, "unsupported_type")
        self.assertIn("convert to PDF", cm.exception.detail)
        with self.assertRaises(documents.DocError):
            documents.save("linkedin", None, "a.tex", io.BytesIO(b"x"))
        with self.assertRaises(documents.DocError) as cm:
            documents.save("nope", None, "a.pdf", io.BytesIO(b"x"))
        self.assertEqual(cm.exception.code, "bad_folder")

    def test_traversal_is_neutralised(self):
        item = documents.save("cv", None, "../../evil.pdf", io.BytesIO(b"x"))
        self.assertEqual(item["path"], "documents/cv/evil.pdf")
        with self.assertRaises(documents.DocError) as cm:
            documents.save("applications", "../x", "a.md", io.BytesIO(b"x"))
        self.assertEqual(cm.exception.code, "bad_subfolder")
        with self.assertRaises(documents.DocError):
            documents.safe_name("..")
        self.assertEqual(documents.safe_name(".env.pdf"), "env.pdf")  # leading dot stripped, not hidden
        self.assertEqual(documents.safe_name("a/b\\c d.pdf"), "c d.pdf")
        with self.assertRaises(documents.DocError):
            documents.save("cv", "sub", "a.pdf", io.BytesIO(b"x"))  # only applications take a subfolder

    def test_size_cap_leaves_no_partial(self):
        big = io.BytesIO(b"\0" * (documents.MAX_BYTES + 1))
        with self.assertRaises(documents.DocError) as cm:
            documents.save("cv", None, "big.pdf", big)
        self.assertEqual(cm.exception.code, "too_large")
        self.assertEqual(list((paths.DOCS / "cv").iterdir()), [])

    def test_overwrite_delete_and_listing(self):
        documents.save("cv", None, "cv.pdf", io.BytesIO(b"one"))
        documents.save("cv", None, "cv.pdf", io.BytesIO(b"two"))
        self.assertEqual((paths.DOCS / "cv" / "cv.pdf").read_bytes(), b"two")
        documents.save("applications", "acme_analyst", "cv_draft.tex", io.BytesIO(b"x"))
        (paths.DOCS / "cv" / ".gitkeep").write_text("")
        listing = documents.listing()
        self.assertEqual(listing["total"], 2)
        self.assertEqual([f["name"] for f in listing["folders"]["cv"]], ["cv.pdf"])
        self.assertEqual(listing["folders"]["applications"][0]["name"], "acme_analyst")
        documents.delete("applications", "acme_analyst", "cv_draft.tex")
        self.assertFalse((paths.DOCS / "applications" / "acme_analyst").exists())
        with self.assertRaises(documents.DocError) as cm:
            documents.delete("cv", None, "missing.pdf")
        self.assertEqual(cm.exception.code, "not_found")


if __name__ == "__main__":
    unittest.main()
