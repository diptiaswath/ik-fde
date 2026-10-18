# Activity: Route the Models

**Time: 6 minutes**

## The Task

Assign a model (Haiku or Sonnet) to each pipeline step. Defend one choice.

---

## The Pipeline

| Step | What It Does | Volume |
|------|--------------|--------|
| **Triage** | Classify Type A (fraud) vs Type B (merchant dispute) | Every dispute (3,000/month) |
| **Evidence** | Gather artifacts, summarize in 2 sentences | Every dispute (3,000/month) |
| **Policy** | Apply Reg E law, cite policy, recommend payout/deny | Type A only (~1,800/month) |

---

## Your Models

| Model | Cost | Best For |
|-------|------|----------|
| **Haiku** (cheap/fast) | $1/M tokens in, $5/M out | Classification, summarization, high-volume |
| **Sonnet** (expensive/smart) | $3/M in, $15/M out | Complex reasoning, money decisions, regulatory |

**Key question:** Where does **money move**? That's where you need the expensive model.

---

## Deliverable (Post This)

```
ROUTING:
Triage:   [Haiku / Sonnet]
Evidence: [Haiku / Sonnet]
Policy:   [Haiku / Sonnet]

DEFENSE (pick one step):
Step: [which one]
Model: [Haiku/Sonnet]
Why: [1 sentence - what's special about this step?]
```

---

## Decision Guide

**Use Haiku when:**
- High volume (every dispute)
- Low stakes (classification, summarization)
- Reversible (can fix mistakes later)

**Use Sonnet when:**
- Money moves based on this output
- Regulatory audit required
- Mistakes are expensive (fines, customer harm)

---

## Example (Don't Copy!)

```
ROUTING:
Triage:   Haiku
Evidence: Haiku
Policy:   Sonnet

DEFENSE:
Step: Policy
Model: Sonnet
Why: This is where provisional credit decisions happen - money moves,
regulators audit it, and mistakes cost more than inference.
```

---

## What to Think About

**Triage:**
- Just classification (10.x/11.x = Type A, 12.x/13.x = Type B)
- Every dispute runs this
- Is Haiku good enough for simple rules?

**Evidence:**
- Summarizes artifacts from 3 systems
- No decisions made here
- Sonnet better at synthesis, but worth 3x cost?

**Policy:**
- Applies Reg E law (complex multi-step reasoning)
- Recommends money action (provisional credit vs deny)
- Audited by regulators
- Where would YOU spend the expensive model?

---

## The Real Answer (From demo2_pipeline.py)

```python
triage = Agent(
    model=LitellmModel(model=MODEL_FAST),    # Haiku
    instructions="Classify Type A/B..."
)

evidence = Agent(
    model=LitellmModel(model=MODEL_FAST),    # Haiku
    instructions="Gather evidence, summarize..."
)

policy = Agent(
    model=LitellmModel(model=MODEL_SMART),   # Sonnet ← THE MONEY STEP
    instructions="Apply Reg E, cite policy, recommend action..."
)
```

**Pattern:** Cheap by default, expensive only where money moves.

---

## Quick Cost Math (Optional)

```
All Haiku:  3 steps × 3,000 disputes = ~$90/month
All Sonnet: 3 steps × 3,000 disputes = ~$270/month

Smart routing (2 Haiku, 1 Sonnet on Type A only):
- Triage: 3,000 × cheap = ~$30
- Evidence: 3,000 × cheap = ~$30
- Policy: 1,800 × expensive = ~$50
Total: ~$110/month

Savings: 60% vs all Sonnet
```

---

## Timeline

- **0-3 min:** Make routing decisions
- **3-5 min:** Write your defense
- **5-6 min:** Post in chat
- **6 min:** Discuss as group

---

## Discussion Questions

1. How many chose Sonnet for Policy? (Show of hands)
2. Why is Policy different from Triage and Evidence?
3. What's the cost trade-off you made?
4. Would you change your routing if volume was 30,000/month instead of 3,000?

---

**Go! 6 minutes.**
