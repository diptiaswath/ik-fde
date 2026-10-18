# Insurance Claims Intake Agent - Guardrail Design Activity

**Time: 10 minutes**

## What You're Designing

An insurance carrier's **claims intake agent** processes new claims submissions. You need to design **two guardrails** to prevent failures:

1. **ONE input guardrail** - catches bad data BEFORE the agent acts on it
2. **ONE output guardrail** - catches unshippable recommendations BEFORE they reach the customer

---

## The Template (Copy This)

For each guardrail, specify:

```
TRIGGER CONDITION → ACTION → FAILURE MODE IT PREVENTS
```

### Example from Meridian (Banking)

```
INPUT GUARDRAIL
Trigger: Retrieved policy chunk contains "ignore prior instructions" or other injection markers
Action: Quarantine the chunk, exclude from context
Failure mode prevented: Prompt injection attack causing data exfiltration or unauthorized actions

OUTPUT GUARDRAIL
Trigger: Agent recommends "provisional credit" but text lacks [chunk NN] citation
Action: Block output, create human-review ticket instead
Failure mode prevented: Uncited money-moving decision → regulatory violation + audit failure
```

---

## Your Insurance Claims Context

### The Agent's Job

- Customer submits a claim (auto accident, property damage, medical, etc.)
- Agent triages: fraud vs legitimate, fast-track vs full investigation
- Agent determines initial payout estimate
- Agent routes to adjuster or auto-approves small claims

### What Could Go Wrong?

**Input side:**
- Fraudulent submissions
- Incomplete data
- Duplicate claims
- Tampered evidence
- Malicious file uploads

**Output side:**
- Wrong payout amount
- Missed fraud indicators
- Regulatory violations
- Discriminatory language
- Uncited/unauditable decisions

---

## Starter Questions to Spark Ideas

### For INPUT Guardrail, Ask:

- What if a claimant submits the same claim twice (duplicate detection)?
- What if uploaded photos are corrupted or contain hidden injection prompts?
- What if claim amount is suspiciously high ($1M for a fender bender)?
- What if personal data is missing (SSN, policy number)?
- What if evidence documents contain malicious content?
- What if claim date is in the future or >5 years ago?
- What if VIN/policy number doesn't match carrier's records?

### For OUTPUT Guardrail, Ask:

- What if agent approves a payout above its authority limit ($50K when limit is $10K)?
- What if recommendation lacks required fraud score or risk assessment?
- What if language could be discriminatory (mentions race, age, gender, etc.)?
- What if payout calculation has no audit trail/citation to policy terms?
- What if claim is auto-approved but flagged as high-risk?
- What if settlement amount differs significantly from damage estimate?
- What if output lacks required regulatory disclosures?

---

## Example Scenarios to Get You Unstuck

### Scenario 1: Duplicate Claim
- Customer submits claim #12345 for $5,000 car damage (VIN: ABC123, date: 2025-10-01)
- 2 hours later, same customer submits claim #12389 for same VIN, same date, $5,100
- **What's the guardrail?**

### Scenario 2: Runaway Payout
- Agent recommends: "Approve $150,000 payout for water damage claim"
- But agent's authority limit is $25,000, anything above needs human adjuster
- **What's the guardrail?**

### Scenario 3: Missing Fraud Check
- Agent outputs: "APPROVE - no issues found, pay claimant $8,500"
- But output lacks `fraud_score` field that compliance requires for audit
- **What's the guardrail?**

### Scenario 4: Discriminatory Language
- Agent outputs: "Deny claim - typical for elderly drivers to cause these accidents"
- Contains age-based language that violates anti-discrimination regulations
- **What's the guardrail?**

### Scenario 5: Uncited Policy Decision
- Agent outputs: "Deny claim - not covered under policy"
- No reference to specific policy section/exclusion clause
- **What's the guardrail?**

---

## Timeline

- **Minutes 0-3:** Pick your trigger conditions (what specific thing fires the guardrail?)
- **Minutes 3-7:** Define the actions (block? quarantine? route to human?)
- **Minutes 7-9:** Articulate the failure mode (what disaster are you preventing?)
- **Minute 10:** Post in chat!

---

## Good Guardrails Are:

✅ **Deterministic** - "if payout > $10,000" not "if payout seems high"
✅ **Fail-closed** - When unsure, block/quarantine, don't let through
✅ **Testable** - You can write a unit test for the trigger condition
✅ **Specific to risk** - Targets a real failure mode (fraud, compliance, cost)

❌ **Avoid:**
- Vague triggers like "suspicious claim" or "bad data"
- Actions that "log and continue" (that's not a guardrail, that's monitoring)
- Failure modes that are hypothetical ("might cause confusion")

---

## The Meridian Parallel (Learning Transfer)

| Meridian (Banking) | Your Insurance Agent |
|--------------------|----------------------|
| **Input:** Poisoned policy chunk 121 with injection markers | **Input:** Fraudulent/duplicate/corrupted claim data |
| **Output:** Uncited provisional credit claim | **Output:** Payout without fraud check / above authority limit |
| **Action:** Quarantine chunk / Block + human review | **Action:** Reject claim / Escalate to adjuster |
| **Why:** Regulatory compliance (Reg E) + audit trail | **Why:** Fraud prevention + regulatory compliance + cost control |
| **Regex:** `ignore (prior\|previous) (constraints\|instructions)` | **Regex:** Duplicate VIN+date, payout > limit, missing required fields |
| **Fail-closed:** Exclude poisoned chunk, run on clean only | **Fail-closed:** Reject claim, route to human adjuster |

---

## Deliverable Format (Copy-Paste Ready)

```
INPUT GUARDRAIL
Trigger: [when does it fire? be specific!]
Action: [what happens? block/quarantine/route?]
Failure mode prevented: [what disaster does this avoid?]

OUTPUT GUARDRAIL
Trigger: [when does it fire? be specific!]
Action: [what happens? block/escalate/withhold?]
Failure mode prevented: [what disaster does this avoid?]
```

### Example Answer (Don't Copy - Make Your Own!)

```
INPUT GUARDRAIL
Trigger: Claim submission with (VIN + incident_date) matches existing claim in past 72 hours
Action: Reject submission, return error "Duplicate claim detected - claim #XXXXX already filed"
Failure mode prevented: Duplicate claim fraud (customer filing same accident twice to double-collect)

OUTPUT GUARDRAIL
Trigger: Agent recommends payout amount > $25,000 (authority limit threshold)
Action: Block auto-approval, route to senior adjuster queue with recommendation as draft
Failure mode prevented: Unauthorized large payout → financial loss + compliance violation
```

---

## If You Finish Early

### Bonus 1: Write the Unit Test

```python
# Example from Meridian output guardrail
def test_citation_tripwire():
    # Should PASS (citation present)
    assert citation_check("Issue provisional credit [chunk 101]") == (False, "ok")

    # Should TRIP (no citation)
    assert citation_check("Just issue provisional credit") == (True, "uncited money claim")

    # Edge case: citation but no money claim
    assert citation_check("See policy [chunk 5] for details") == (False, "ok")
```

**What would your insurance guardrail tests look like?**

Example:
```python
def test_duplicate_claim_guardrail():
    # Should PASS (new claim)
    assert check_duplicate(vin="ABC123", date="2025-10-15", existing_claims=[]) == (False, "ok")

    # Should TRIP (duplicate within 72h)
    existing = [{"vin": "ABC123", "date": "2025-10-14"}]
    assert check_duplicate(vin="ABC123", date="2025-10-15", existing_claims=existing) == (True, "duplicate")

    # Edge case: same VIN, but >72h apart
    existing = [{"vin": "ABC123", "date": "2025-10-01"}]
    assert check_duplicate(vin="ABC123", date="2025-10-15", existing_claims=existing) == (False, "ok")
```

### Bonus 2: Sketch the Code

```python
import re

# INPUT GUARDRAIL EXAMPLE
def check_duplicate_claim(claim: dict, existing_claims: list) -> tuple[bool, str]:
    """Trip if same VIN + date within 72 hours."""
    for existing in existing_claims:
        if (claim["vin"] == existing["vin"] and
            abs((claim["incident_date"] - existing["incident_date"]).days) <= 3):
            return True, f"duplicate of claim #{existing['claim_id']}"
    return False, "ok"

# Wire to agent as @input_guardrail
@input_guardrail
async def duplicate_claim_guardrail(ctx, agent, input) -> GuardrailFunctionOutput:
    claim_data = extract_claim_from_input(input)
    existing = ctx.db.get_recent_claims(customer_id=claim_data["customer_id"])
    tripped, why = check_duplicate_claim(claim_data, existing)
    return GuardrailFunctionOutput(
        output_info={"reason": why},
        tripwire_triggered=tripped
    )
```

```python
# OUTPUT GUARDRAIL EXAMPLE
AUTHORITY_LIMIT = 25000  # $25K auto-approval threshold
REQUIRED_FIELDS = ["fraud_score", "damage_assessment", "policy_citation"]

def check_payout_authority(output: str) -> tuple[bool, str]:
    """Trip if payout exceeds authority limit or missing required fields."""
    # Extract payout amount
    match = re.search(r'\$?([\d,]+)', output)
    if match:
        amount = int(match.group(1).replace(',', ''))
        if amount > AUTHORITY_LIMIT:
            return True, f"payout ${amount} exceeds authority limit ${AUTHORITY_LIMIT}"

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in output.lower():
            return True, f"missing required field: {field}"

    return False, "ok"

# Wire to agent as @output_guardrail
@output_guardrail
async def payout_authority_guardrail(ctx, agent, output: str) -> GuardrailFunctionOutput:
    tripped, why = check_payout_authority(str(output))
    return GuardrailFunctionOutput(
        output_info={"reason": why},
        tripwire_triggered=tripped
    )
```

---

## Real-World Variations to Consider

### Different Insurance Types

**Auto Insurance:**
- Input: VIN validation, license plate lookup, driver record check
- Output: Payout must cite damage assessment report, total loss threshold

**Property/Homeowners:**
- Input: Address validation, duplicate claims (same address + date)
- Output: Payout must cite policy coverage limits, deductible calculation

**Health/Medical:**
- Input: Diagnosis code validation, provider network check
- Output: Must cite CPT codes, insurance formulary for prescriptions, pre-authorization

**Business/Commercial:**
- Input: Business entity validation, policy-in-force check
- Output: Loss of income claims must cite financial statements, business interruption clause

### Compliance Considerations

**State Regulations:**
- Some states require specific disclosures in denial letters
- Unfair claims practices acts (time limits, required communications)
- Anti-discrimination laws (protected classes)

**Industry Standards:**
- NAIC (National Association of Insurance Commissioners) guidelines
- ISO (Insurance Services Office) claim forms
- Fraud detection consortium data sharing

---

## Common Mistakes to Avoid

### ❌ Too Vague
```
INPUT: Check if claim looks suspicious
OUTPUT: Make sure payout is reasonable
```
**Why bad:** Not deterministic, can't test, "suspicious" and "reasonable" are subjective

### ❌ Too Lenient
```
INPUT: Log a warning if duplicate detected, but process anyway
OUTPUT: Alert adjuster if payout >$50K, but approve it
```
**Why bad:** Not fail-closed - guardrail should BLOCK, not just warn

### ❌ Wrong Layer
```
INPUT: Check if customer is lying
OUTPUT: Make sure customer deserves payout
```
**Why bad:** Guardrails are code, not judgment calls - use fraud models, not vibes

### ✅ Good Examples
```
INPUT: Reject if (VIN + incident_date) matches claim filed <72h ago
OUTPUT: Block if payout >$25K OR missing fraud_score field

INPUT: Quarantine if uploaded file extension not in [.jpg, .pdf, .png]
OUTPUT: Block if recommendation contains protected-class terms [elderly, disabled, racial terms]

INPUT: Reject if policy_number not found in active policies table
OUTPUT: Block if "APPROVE" but policy_citation field is null/empty
```

---

## Post This at the Bell

```
INPUT GUARDRAIL
Trigger:
Action:
Failure mode prevented:

OUTPUT GUARDRAIL
Trigger:
Action:
Failure mode prevented:
```

**Your name:**
**Bonus (optional):** Unit test snippet or code sketch

---

## After the Activity: Discussion Questions

1. **Which guardrail was harder to design - input or output? Why?**

2. **What's the trade-off between fail-closed and customer experience?**
   - Strict duplicate detection might reject legitimate claims (two accidents same day)
   - Strict payout limits might delay urgent claims
   - How do you balance safety and friction?

3. **How would you test these guardrails before going live?**
   - Synthetic test cases (known duplicates, known fraud patterns)
   - Shadow mode (run guardrail, log result, but don't block)
   - A/B test (guardrail on vs off, measure fraud rate + false positive rate)

4. **What happens when the guardrail trips in production?**
   - Customer sees: "Your claim requires additional review"
   - Adjuster sees: "Guardrail trip: duplicate_claim_detected, reason: VIN match claim #12345"
   - Audit log: timestamp, claim_id, guardrail_type, trip_reason, customer_id

5. **How would you evolve these guardrails over time?**
   - Monitor false positive rate (legitimate claims blocked)
   - Monitor false negative rate (fraud that slipped through)
   - Add new patterns as fraud evolves (deepfake photos, synthetic identities)

---

## Connection to W15 Concepts

| W15 Concept | How It Applies Here |
|-------------|---------------------|
| **@input_guardrail** | Your duplicate/fraud check on incoming claim data |
| **@output_guardrail** | Your payout authority / citation check on agent recommendation |
| **GuardrailFunctionOutput** | `tripwire_triggered=True` blocks the run, routes to human |
| **Fail-closed** | When unsure (missing data, edge case), reject/escalate - don't approve |
| **Deterministic** | Regex, field checks, threshold comparisons - not LLM vibes |
| **Unit-testable** | Every trigger condition has test cases (pass/trip/edge) |
| **Audit trail** | Trace span records: guardrail fired, reason, timestamp, context |

---

## Further Reading

- **Meridian Demo 2:** `demo2_pipeline.py` lines 80-91 (input guardrail), 105-109 (output guardrail)
- **W15 Notebook §2.4:** Guardrail design + unit testing pattern
- **Insurance Fraud Stats:** Coalition Against Insurance Fraud (CAIF) - $308B annual fraud cost
- **Regulatory:** NAIC Model Unfair Claims Settlement Practices Act

---

**Now go design your guardrails! 10 minutes on the clock.**
