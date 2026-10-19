# The Meridian Engagement — one entry point for everything.
# Every target is idempotent and safe to re-run. `make help` lists them.
.DEFAULT_GOAL := help
SHELL := /bin/bash

PORT       ?= 3100
DB_URL     ?= postgresql://meridian:meridian@localhost:5432/meridian
BASE_URL   ?= http://localhost:$(PORT)/api/v1
CONSOLE    ?= http://localhost:$(PORT)
DISPUTE    ?= 29
SCALE      ?= demo

export MERIDIAN_DB_URL      := $(DB_URL)
export MERIDIAN_BASE_URL    := $(BASE_URL)
export MERIDIAN_CONSOLE_URL := $(CONSOLE)

.PHONY: help up deps seed keys web web-dev agent eval test down clean doctor

help: ## show this list
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	  awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

up: ## Postgres + schema + seed + two scoped API keys (the one-command bank)
	cd platform/db && docker compose up -d
	@echo "==> waiting for Postgres…"
	@until (cd platform/db && docker compose exec -T meridian-db pg_isready -U meridian >/dev/null 2>&1); do sleep 1; done
	$(MAKE) seed
	@cd platform/db && docker compose exec -T meridian-db psql -U meridian -d meridian -q -v ON_ERROR_STOP=1 < api.sql
	@echo "==> api.sql applied"
	$(MAKE) keys
	@echo ""
	@echo "==> ready. next: make web   (console on $(CONSOLE))"

deps: ## install the console's node deps (needed by mint-key too)
	@# check a real dependency, not just the folder: a half-installed node_modules
	@# silently 500s every API route, which is a miserable thing to debug in class.
	@cd platform/web && { node -e "require.resolve('pg')" >/dev/null 2>&1 || npm install --silent; }
	@cd platform/web && node -e "require.resolve('pg')" >/dev/null 2>&1 || \
	  { echo "!! node deps still missing — run: cd platform/web && npm install"; exit 1; }
	@cd platform/web && printf 'MERIDIAN_DB_URL=$(DB_URL)\n' > .env.local

seed: ## regenerate + load the deterministic seed (SCALE=demo|full)
	cd platform/db && ./load.sh $(SCALE)

keys: deps ## mint a type_a + type_b analyst key pair (print once, copy into .env)
	@cd platform/db && node mint-key.mjs --demo

web: deps ## build + serve the Ops Console on :$(PORT)
	cd platform/web && npm run build && PORT=$(PORT) npm run start

web-dev: deps ## hot-reload the console instead (development)
	cd platform/web && PORT=$(PORT) npm run dev

agent: ## run the triage pipeline on dispute $(DISPUTE) (mock brain, no AWS)
	cd agent && uv run meridian-agent run --dispute $(DISPUTE) --mock

eval: ## the smoke eval gate — the same gate CI runs on every PR
	cd agent && uv run meridian-agent eval --suite smoke --min-pass 0.9 --mock

golden: ## the full 150-case golden gate (incl. adversarial) — the release gate
	cd agent && uv run meridian-agent eval --suite golden --min-pass 0.95 --mock

verify: ## $$0 smoke gate: prerequisites + smoke eval + unit tests. Run this first.
	@$(MAKE) --no-print-directory doctor
	@echo
	@$(MAKE) --no-print-directory eval
	@echo
	@$(MAKE) --no-print-directory test
	@echo "verify: OK"

test: ## the agent's pytest suite
	cd agent && uv run pytest -q

doctor: ## check prerequisites and report what's missing
	@echo "docker : $$(docker --version 2>/dev/null || echo MISSING)"
	@echo "node   : $$(node -v 2>/dev/null || echo MISSING)"
	@echo "python : $$(python3 -V 2>/dev/null || echo MISSING)"
	@echo "uv     : $$(uv --version 2>/dev/null || echo 'MISSING — https://docs.astral.sh/uv/')"
	@echo "aws    : $$(aws --version 2>/dev/null || echo 'missing (only needed for the cloud rungs)')"
	@echo "db     : $$(cd platform/db && docker compose exec -T meridian-db pg_isready -U meridian 2>/dev/null || echo 'not running — make up')"

down: ## stop Postgres (data survives)
	cd platform/db && docker compose down

clean: ## stop Postgres AND delete the data volume
	cd platform/db && docker compose down -v
