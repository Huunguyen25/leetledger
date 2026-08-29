# --- Configuration ---
SHELL := /bin/bash

.PHONY: install

install:
	npm install

.PHONY: all compile build test dev clean validate

.DEFAULT_GOAL := all

all: compile validate build 

.PHONY: validate

validate:
	npm run lint && npm run test
	@echo "Codebase is valid"

clean:
	@echo "Cleaning up codebase"
	rm -rf .output .wxt .chrome-dev-data dist

compile:
	npm run compile

build:
	npm run build

test:
	npm run test

dev:
	npm run dev
