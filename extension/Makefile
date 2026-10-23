SHELL := /bin/bash

.PHONY: install all compile build test dev clean validate

.DEFAULT_GOAL := all

# install: Install project dependencies
install:
	npm install

# all: Compile, validate, then build
all: compile validate build 

# validate: Lint and test the codebase
validate:
	npm run lint && npm run test
	@echo "Codebase is valid"

# clean: Remove build and temp output directories
clean:
	@echo "Cleaning up codebase"
	rm -rf .output .wxt .chrome-dev-data dist

# compile: Compile sources
compile:
	npm run compile

# build: Build for production
build:
	npm run build

# test: Run all tests
test:
	npm run test

# dev: Start project in development mode
dev:
	npm run dev
