SHELL := /bin/bash

.PHONY: install all compile build test dev start clean validate

.DEFAULT_GOAL := all

# install: Install project dependencies
install:
	npm install

# all: Compile, validate, then build
all: compile validate build

# validate: Lint and test the codebase
validate:
	npm run lint
	$(MAKE) test
	@echo "Codebase is valid"

# clean: Remove Next.js build and generated output
clean:
	@echo "Cleaning up codebase"
	rm -rf .next out coverage

# compile: Type-check sources without emitting files
compile:
	npx tsc --noEmit

# build: Build for production
build:
	npm run build

# test: Run tests when a test script is configured
test:
	@if npm pkg get scripts.test | grep -qv '^{}$$'; then \
		npm run test; \
	else \
		echo "No test script configured; skipping tests"; \
	fi

# dev: Start project in development mode
dev:
	npm run dev

# start: Start the production server
start:
	npm run start
