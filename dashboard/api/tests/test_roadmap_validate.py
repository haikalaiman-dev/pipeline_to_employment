import copy
import unittest

from dashboard.api.profile import validate_roadmap

VALID = {
    "generated_at": "2026-09-13T00:00:00+00:00",
    "current": {"title": "Data Analyst", "level": "mid", "years": 5, "summary": "Analytics focus."},
    "past": [{"title": "Junior Analyst", "company": "Beta", "start": "2018", "end": "2021", "skills": ["Excel"]}],
    "next": [
        {"title": "Senior Data Analyst", "level": "senior", "why": "natural step", "readiness": 70,
         "missing_skills": [{"skill": "dbt", "priority": "high", "est_hours": 40}]},
        {"title": "Analytics Lead", "level": "lead", "why": "leads the analytics team", "readiness": 45, "missing_skills": []},
    ],
    "levers": [{"skill": f"s{i}", "priority": "medium", "why": "w", "resources": [{"label": "l", "url": "https://x"}]} for i in range(5)],
    "milestones": [{"label": f"m{i}", "target_quarter": f"2026-Q{(i % 4) + 1}"} for i in range(4)],
}


class ValidateRoadmap(unittest.TestCase):
    def test_valid(self):
        self.assertEqual(validate_roadmap(VALID), [])

    def test_errors_name_the_field(self):
        doc = copy.deepcopy(VALID)
        del doc["levers"]
        self.assertTrue(any("levers" in e for e in validate_roadmap(doc)))
        doc = copy.deepcopy(VALID)
        doc["next"] = doc["next"][:1]
        self.assertTrue(any("next: expected 2-3" in e for e in validate_roadmap(doc)))
        doc = copy.deepcopy(VALID)
        doc["next"][0]["readiness"] = 120
        self.assertTrue(any("readiness" in e for e in validate_roadmap(doc)))
        doc = copy.deepcopy(VALID)
        doc["milestones"][0]["target_quarter"] = "2026-Q5"
        self.assertTrue(any("milestones[0]" in e for e in validate_roadmap(doc)))
        doc = copy.deepcopy(VALID)
        doc["levers"][0]["priority"] = "urgent"
        self.assertTrue(any("levers[0]" in e for e in validate_roadmap(doc)))

    def test_non_object_does_not_raise(self):
        self.assertEqual(validate_roadmap([]), ["top level must be an object"])
        self.assertTrue(validate_roadmap({}))


if __name__ == "__main__":
    unittest.main()
