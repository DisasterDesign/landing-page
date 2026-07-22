# Prospecting AI JSON Contract Design

## Problem

The weekly territory prompt asks Anthropic for JSON but does not state the required property names, types, or `kind` enum. Production therefore accepted a valid JSON object that could not pass the existing Zod schema, leaving the first cycle in `FAILED` before any Google calls were made.

## Decision

Keep the existing strict Zod parser and fail-fast behavior. Add the complete top-level response contract to the territory system prompt: `displayName`, `city`, `kind`, `searchQuery`, `rationale`, `expectedBusinessTypes`, and `confidence`, including their types, limits, and the three allowed `kind` values.

Do not add response-shape guessing, parser coercion, or an automatic retry. Those alternatives can hide contract drift and spend extra API calls. The prompt contract is covered by a regression test that inspects the actual Anthropic request body.

## Verification

The focused AI tests must first fail against the current prompt, then pass after the contract is added. The full prospecting suite, lint, and production build must remain green before redeployment. A new weekly cycle will then validate the real Production Anthropic request.
