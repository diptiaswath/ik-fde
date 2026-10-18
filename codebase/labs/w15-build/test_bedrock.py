import boto3
r = boto3.client("bedrock-runtime", region_name="us-east-1").converse_stream(
    modelId="us.anthropic.claude-haiku-4-5-20251001-v1:0",
    messages=[{"role":"user","content":[{"text":"Reply with the single word: up"}]}],
    inferenceConfig={"maxTokens":8,"temperature":0})
print("".join(e["contentBlockDelta"]["delta"].get("text","")
       for e in r["stream"] if "contentBlockDelta" in e))
