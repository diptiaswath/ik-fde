#!/usr/bin/env python3
"""Test Lambda handler.py locally without deploying to AWS.

Usage:
    # With mock Meridian data
    MERIDIAN_MOCK=1 python3 test_handler_local.py

    # With live Meridian API (requires valid API key)
    python3 test_handler_local.py
"""
import json
import os
import sys
from pathlib import Path

# Add handler.py to path
sys.path.insert(0, str(Path(__file__).parent))

# Mock mode flag
MOCK = os.environ.get("MERIDIAN_MOCK") == "1"

# Set env vars BEFORE importing handler (handler reads them at import time)
if MOCK:
    print("🔧 Running in MOCK mode (no AWS, no API key needed)\n")

    # Set mock env vars before importing handler
    os.environ["MERIDIAN_BASE_URL"] = "http://localhost:3100/api/v1"
    os.environ["MERIDIAN_API_KEY"] = "mock-key"
    os.environ["DEMO_TOKEN"] = "test-token"

    # Now import handler
    import handler

    # Load fixture data
    FIXTURE = json.loads((Path(__file__).parents[1] / "data" / "fixture.json").read_text())

    # Mock _meridian to use fixture instead of API
    def _meridian_mock(path, method="GET", body=None, idem_key=None):
        did = path.split("/")[2] if path.startswith("/disputes/") else None
        bundle = FIXTURE["disputes"].get(did or "", {})

        if path.endswith("/evidence"):
            return {"evidence": bundle.get("evidence", [])}
        if path.endswith("/tickets"):
            import uuid
            return {"ticket": {"ticket_id": f"MOCK-{uuid.uuid4().hex[:6]}",
                              "dispute_id": did, "subject": body["subject"]}}
        if path.startswith("/policies"):
            return {"chunks": FIXTURE["policy_chunks"][:6]}
        if "/disputes/" in path:
            return {"dispute": bundle}
        return {}

    # Mock _claude to return canned response
    def _claude_mock(prompt, max_tokens=500):
        return ("Reg E applies: the bank must resolve or issue provisional "
                "credit within 10 business days [chunk 1]. The clock on this "
                "dispute is already breached and provisional credit has not "
                "been issued. Recommend immediate provisional credit and "
                "human confirmation.\nRECOMMENDATION: HUMAN_REVIEW")

    # Replace handler functions with mocks
    handler._meridian = _meridian_mock
    handler._claude = _claude_mock
else:
    print("🌐 Running in LIVE mode (requires valid MERIDIAN_API_KEY)\n")

    # Check that required env vars are set
    if not os.environ.get("MERIDIAN_API_KEY"):
        print("❌ Error: MERIDIAN_API_KEY environment variable not set")
        print("\nSet it with:")
        print("  export MERIDIAN_API_KEY=mrdn_YOUR_KEY")
        print("\nOr run in mock mode:")
        print("  MERIDIAN_MOCK=1 python3 test_handler_local.py")
        sys.exit(1)

    # Import handler in live mode
    import handler

# Get lambda_handler function
lambda_handler = handler.lambda_handler

# Test event (simulates Lambda invocation)
event = {
    "body": json.dumps({"dispute_id": 29}),
    "headers": {
        "X-Demo-Token": os.environ.get("DEMO_TOKEN", "test-token")
    }
}

# Mock Lambda context (not used by handler, but required by signature)
class MockContext:
    def __init__(self):
        self.function_name = "meridian-w15-agent"
        self.memory_limit_in_mb = 256
        self.invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:meridian-w15-agent"
        self.aws_request_id = "test-request-id"

context = MockContext()

print("=" * 60)
print("Testing Lambda handler.py locally")
print("=" * 60)
print(f"Mode: {'MOCK' if MOCK else 'LIVE'}")
print(f"Dispute ID: 29")
print(f"Base URL: {os.environ.get('MERIDIAN_BASE_URL', 'not set')}")
print("=" * 60)
print()

try:
    # Invoke the handler
    print("📞 Invoking lambda_handler(event, context)...\n")
    result = lambda_handler(event, context)

    print("✅ Handler returned successfully\n")
    print("=" * 60)
    print("RESPONSE:")
    print("=" * 60)

    if isinstance(result, dict):
        # Pretty print the response
        if "body" in result:
            body = json.loads(result["body"]) if isinstance(result["body"], str) else result["body"]
            print(f"Status Code: {result.get('statusCode', 'N/A')}")
            print(f"\nBody:")
            print(json.dumps(body, indent=2))
        else:
            print(json.dumps(result, indent=2))
    else:
        print(result)

    print("\n" + "=" * 60)

    if MOCK:
        print("\n✨ Mock mode test completed!")
        print("   - No AWS calls made")
        print("   - No API key used")
        print("   - Fixture data used")
        print("   - Guardrail logic ran")
    else:
        print("\n✨ Live mode test completed!")
        print("   - Called real Meridian API")
        print("   - Called AWS Bedrock (if handler uses it)")
        print("   - Created real ticket (or attempted to)")

except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
