# Testing Documentation

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode
npm run test:watch
```

## Test Coverage

### Background Script Tests (`background.logic.test.ts`)

Tests for the background script's URL filtering and duplicate submission processing logic:

1. **URL Filtering (`isSubmissionUrl`)**
   - ✅ Correctly identifies submission check URLs containing `/check/`
   - ✅ Filters out non-submission URLs

2. **Submission ID Extraction (`extractSubmissionId`)**
   - ✅ Extracts numeric submission IDs from valid URLs
   - ✅ Extracts alphanumeric IDs (for test runs)
   - ✅ Returns null for invalid URLs

3. **Valid Submission Detection (`isValidSubmissionId`)**
   - ✅ Accepts only numeric submission IDs
   - ✅ Rejects test runs and non-numeric IDs (e.g., `runcode_123`)

4. **Duplicate Processing Prevention (`createSubmissionTracker`)**
   - ✅ Prevents duplicate processing of the same submission ID
   - ✅ Tracks submissions currently being processed
   - ✅ Tracks already completed submissions
   - ✅ Handles concurrent processing of multiple submissions
   - ✅ Evicts oldest submissions when cache limit is reached

## Architecture

The codebase follows a testable architecture pattern:

- **Logic Modules** (`*.logic.ts`): Pure, testable functions and utilities
- **Entry Points** (`background.ts`, `content.ts`): WXT-specific wrappers that use logic modules
- **Tests** (`*.logic.test.ts`): Unit tests for the logic modules

This separation allows comprehensive testing without browser extension APIs.
