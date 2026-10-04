# Makefile for warehouse-console: thin wrappers over npm so `make check` works in every fleet repo.
.PHONY: help install lint typecheck test build check check-all
help:
	@echo "targets: install lint typecheck test build check check-all check-fast guide-lint harness-test"
install:
	npm ci
lint:
	npm run lint
typecheck:
	npm run typecheck
test:
	npm test
build:
	npm run build
check: lint typecheck test build
check-all: check

# --- agent harness (harness-template v3) -----------------------------------
.PHONY: check-fast guide-lint harness-test
# Fast local gate used by the agent Stop hook (this repo's own quick checks).
check-fast: lint typecheck

guide-lint: ## lint agent guides: skills load, references resolve, context budget
	python3 scripts/harness/guide_lint.py

harness-test: ## unit-test the agent hooks (pre/post/stop)
	python3 scripts/harness/test_hook.py
