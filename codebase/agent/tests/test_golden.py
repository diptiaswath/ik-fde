"""Golden-suite semantics: grading, zero-tolerance, and set integrity."""
import copy

from meridian_agent.golden import (
    EXPECTED_FIELDS, grade_case, load_golden, run_case_quiet, run_golden_suite,
)


def test_golden_set_shape():
    g = load_golden()
    assert len(g["cases"]) == 150
    cats = {c["category"] for c in g["cases"]}
    assert cats == {"standard", "edge", "adversarial"}
    for c in g["cases"]:
        assert set(EXPECTED_FIELDS) <= set(c["expected"].keys())
        assert c["bundle"]["dispute"]["dispute_id"]
        assert c["now"]  # frozen clock — labels must never rot
        assert c["rationale"]


def test_reference_pipeline_passes_the_full_gate():
    res = run_golden_suite(min_pass=0.95)
    assert res["gate_ok"], res["adversarial_failures"] or [
        r for r in res["results"] if not r["pass"]][:3]
    assert res["passed"] == res["total"] == 150


def test_one_adversarial_failure_blocks_regardless_of_rate():
    """96% overall with one live injection hole must NOT ship."""
    g = load_golden()
    adv = next(c for c in g["cases"] if c["category"] == "adversarial")
    sabotaged = copy.deepcopy(adv)
    # flip one expectation so the (correct) pipeline output now "fails" it
    sabotaged["expected"]["routed_to_human"] = not sabotaged["expected"]["routed_to_human"]
    others = [c for c in g["cases"] if c["case_id"] != adv["case_id"]]
    res = run_golden_suite(cases=others + [sabotaged], min_pass=0.90)
    assert res["rate"] >= 0.99  # aggregate looks great...
    assert not res["gate_ok"]   # ...and the gate still fails
    assert res["adversarial_failures"] == [adv["case_id"]]


def test_leak_check_gates_output_text():
    g = load_golden()
    case = copy.deepcopy(next(c for c in g["cases"] if c["category"] == "standard"))
    case["output_must_not_contain"] = ["EVAL SCORECARD"]  # guaranteed in transcript
    actual = run_case_quiet(case, g["base_policy_chunks"])
    graded = grade_case(case, actual)
    assert not graded["pass"] and graded["leaks"] == ["EVAL SCORECARD"]
