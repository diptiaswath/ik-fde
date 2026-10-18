#!/usr/bin/env python3
"""W14 demo — extracted verbatim from notebook.ipynb (stdlib only). Terminal version."""

# Stdlib only.
from dataclasses import dataclass, field
from typing import Optional

def money(cents_or_dollars, is_cents=False):
    v = cents_or_dollars / 100 if is_cents else cents_or_dollars
    return f"${v:,.0f}"

def rule(title=""):
    line = "=" * 64
    print(line)
    if title:
        print(title)
        print(line)

print("Week 14 notebook ready. Stdlib only, no installs needed.")

# Dimensions with weights (sum doesn't need to be 1; we normalize).
DIMENSIONS = {
    "client_platform_fit":   0.30,   # what the client already runs
    "enterprise_identity":   0.20,   # native RBAC / agent identity story
    "compliance_posture":    0.20,   # SOC2/GLBA maturity, isolation
    "cost":                  0.10,   # token + infra economics
    "ecosystem_maturity":    0.10,   # SDK, tooling, JD signal
    "in_vpc_isolation":      0.10,   # can it run inside the client's network boundary
}

# Scores 1-5 for Meridian (an AWS-estate bank).
STACKS = {
    "OpenAI Agents SDK + AWS Bedrock": {
        "client_platform_fit": 5, "enterprise_identity": 4, "compliance_posture": 5,
        "cost": 4, "ecosystem_maturity": 5, "in_vpc_isolation": 5,
    },
    "OpenAI Agents SDK + Azure Foundry": {
        "client_platform_fit": 2, "enterprise_identity": 5, "compliance_posture": 5,
        "cost": 3, "ecosystem_maturity": 5, "in_vpc_isolation": 4,
    },
    "Google ADK + Gemini + Vercel": {
        "client_platform_fit": 2, "enterprise_identity": 3, "compliance_posture": 4,
        "cost": 5, "ecosystem_maturity": 4, "in_vpc_isolation": 3,
    },
}

def score(stacks, dims):
    wsum = sum(dims.values())
    results = {}
    for name, sc in stacks.items():
        total = sum(sc[d] * w for d, w in dims.items()) / wsum
        results[name] = total
    return results

scores = score(STACKS, DIMENSIONS)

rule("STACK-CHOICE MATRIX — scored for Meridian (AWS-estate bank)")
dim_names = list(DIMENSIONS.keys())
hdr = f"{'Stack':34}" + "".join(f"{d[:9]:>10}" for d in dim_names) + f"{'WTD':>8}"
print(hdr); print("-" * len(hdr))
for name, sc in STACKS.items():
    row = f"{name:34.34}" + "".join(f"{sc[d]:>10}" for d in dim_names) + f"{scores[name]:>8.2f}"
    print(row)
print("-" * len(hdr))
print("weights: " + ", ".join(f"{d}={w}" for d, w in DIMENSIONS.items()))
winner = max(scores, key=scores.get)
print(f"\nWinner for Meridian: {winner}  ({scores[winner]:.2f})")
print("(the harness — OpenAI Agents SDK — is common to the top two: the SDK is portable; the CLOUD follows the client)")


# When the answer FLIPS — re-score for a different client and watch the winner change.
def winner_line(label, stacks, dims, tag=""):
    s = score(stacks, dims)
    w = max(s, key=s.get)
    print(f"{label:44} -> {w}  ({s[w]:.2f}){tag}")

print("Same candidate stacks, different clients:")
winner_line("Meridian (AWS-estate bank)", STACKS, DIMENSIONS)

# M365/Entra-first enterprise: platform fit moves to Azure
STACKS_MS = {
    "OpenAI Agents SDK + AWS Bedrock":    dict(STACKS["OpenAI Agents SDK + AWS Bedrock"],    client_platform_fit=2),
    "OpenAI Agents SDK + Azure Foundry":  dict(STACKS["OpenAI Agents SDK + Azure Foundry"], client_platform_fit=5),
    "Google ADK + Gemini + Vercel":       dict(STACKS["Google ADK + Gemini + Vercel"],      client_platform_fit=2),
}
winner_line("M365/Entra-first enterprise", STACKS_MS, DIMENSIONS, "   <- Azure wins")

# GCP-native, cost-sensitive client: platform fit moves to Google, cost weighs more
STACKS_GCP = {
    "OpenAI Agents SDK + AWS Bedrock":    dict(STACKS["OpenAI Agents SDK + AWS Bedrock"],    client_platform_fit=2),
    "OpenAI Agents SDK + Azure Foundry":  dict(STACKS["OpenAI Agents SDK + Azure Foundry"], client_platform_fit=2),
    "Google ADK + Gemini + Vercel":       dict(STACKS["Google ADK + Gemini + Vercel"],      client_platform_fit=5),
}
gcp_weights = dict(DIMENSIONS, cost=0.25)
winner_line("GCP-native, cost-sensitive client", STACKS_GCP, gcp_weights, "   <- Google wins")

print("\nThe lesson: the matrix isn't to find THE answer; it's to make the client-fit logic explicit.")

