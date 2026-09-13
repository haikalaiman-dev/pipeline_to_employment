import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

from dashboard.api import paths, profile

REPO = Path(__file__).resolve().parents[3]

PROFILE_MD = """# Candidate Profile

## Identity
- **Name:** Jane Doe
- **Location:** Example City, Exampleland
- **Status:** Employed, open to offers

### Languages
| Language | Level | Notes |
|----------|-------|-------|
| English | C2 | |
| Spanish | B2 | |

## Education
| Degree | Period | Institution | Key Topics |
|--------|--------|-------------|------------|
| MSc in Computer Science | 2018-2020 | UM | statistics, SQL |

## Professional Experience

### Data Analyst - Acme (2021 - Present)
Example City
- Built dashboards

### Junior Analyst – Beta (2018 – 2021)
Example City
- Triage

## Technical Skills
### Programming & ML
- **Python** (advanced): pandas
"""

CLAUDE_MD = """# Job Application Assistant for Jane Doe

### Identity
- **Name:** Jane Doe
- **LinkedIn headline:** "Data Analyst | Analytics"

### Technical Skills
- **Primary:** Python, SQL, Data Modelling
- **Secondary:** Go
- **Domain:** Forecasting; reporting
- **Software:** Tableau, Looker
"""

QUERIES = """# Search Queries

### Priority 1: Data Analytics

```
site:linkedin.com/jobs "Data Analyst" Exampleland
site:linkedin.com/jobs "Analytics Engineer" Exampleland
```

### Priority 2: [YOUR_DOMAIN_EXPERTISE]

```
site:linkedin.com/jobs "BI Developer" Exampleland
```

### Priority 3: Adjacent
```
site:x "Should Not Appear"
```
"""


class Profile(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.files = {"CLAUDE_MD": root / "CLAUDE.md", "PROFILE_MD": root / "01.md",
                      "SEARCH_QUERIES": root / "sq.md", "PROFILE_ANSWERS": root / "answers.json"}
        self.patches = [mock.patch.object(paths, k, v) for k, v in self.files.items()]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()

    def test_shipped_templates_are_not_a_profile(self):
        shutil.copy(REPO / "CLAUDE.md", self.files["CLAUDE_MD"])
        shutil.copy(REPO / ".claude/skills/job-application-assistant/01-candidate-profile.md", self.files["PROFILE_MD"])
        shutil.copy(REPO / ".claude/skills/job-scraper/search-queries.md", self.files["SEARCH_QUERIES"])
        p = profile.load()
        self.assertFalse(p["exists"])
        self.assertEqual(p["completeness"], 0)
        self.assertIsNone(p["latest_position"])
        self.assertEqual(p["languages"], [])
        self.assertEqual(p["education"], [])
        self.assertIn("YOUR_NAME", p["placeholders"])
        self.assertEqual(profile.hunt_queries(), [])

    def test_missing_files(self):
        p = profile.load()
        self.assertFalse(p["exists"])
        self.assertIsNone(p["generated_at"])

    def test_realistic_fixture(self):
        self.files["CLAUDE_MD"].write_text(CLAUDE_MD)
        self.files["PROFILE_MD"].write_text(PROFILE_MD)
        self.files["SEARCH_QUERIES"].write_text(QUERIES)
        p = profile.load()
        self.assertTrue(p["exists"])
        self.assertEqual(p["identity"]["name"], "Jane Doe")
        self.assertEqual(p["identity"]["headline"], "Data Analyst | Analytics")
        self.assertEqual(p["latest_position"]["title"], "Data Analyst")
        self.assertEqual(p["past"][1]["company"], "Beta")  # en-dash heading parsed
        self.assertEqual(p["years_experience"], date.today().year - 2018)
        self.assertEqual(p["education"][0]["degree"], "MSc")
        self.assertEqual(p["education"][0]["field"], "Computer Science")
        self.assertEqual(p["education"][0]["institution"], "UM")
        self.assertEqual([l["language"] for l in p["languages"]], ["English", "Spanish"])
        self.assertEqual(p["skills"]["primary"], ["Python", "SQL", "Data Modelling"])
        self.assertEqual(p["skills"]["domain"], ["Forecasting", "reporting"])
        self.assertEqual(p["target_roles"], ["Data Analyst", "Analytics Engineer", "Data Analytics", "BI Developer"])
        self.assertEqual(p["completeness"], 100)
        self.assertEqual(p["placeholders"], [])
        self.assertEqual(profile.hunt_queries()[:3], ["Data Analyst", "Analytics Engineer", "Data Analytics"])

    def test_hunt_queries_fall_back_to_answers(self):
        profile.write_answers({"target_titles": ["Junior Analyst", "junior analyst"], "key_skills": ["Tableau"]})
        self.assertEqual(profile.hunt_queries(), ["Junior Analyst", "Tableau"])
        self.assertEqual(profile.load()["answers"]["key_skills"], ["Tableau"])


if __name__ == "__main__":
    unittest.main()
