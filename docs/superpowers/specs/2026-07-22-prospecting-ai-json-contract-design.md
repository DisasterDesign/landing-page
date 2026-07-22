# Prospecting AI JSON Contract Design

## Problem

The weekly territory prompt asks Anthropic for JSON but does not state the required property names, types, or `kind` enum. Production therefore accepted a valid JSON object that could not pass the existing Zod schema, leaving the first cycle in `FAILED` before any Google calls were made. The visual-audit prompt had the same omission for nested finding codes and severity values, so the first active-site audit reached Anthropic but failed validation.

## Decision

Keep the existing strict Zod parsers and fail-fast behavior. Add the complete top-level response contract to the territory system prompt: `displayName`, `city`, `kind`, `searchQuery`, `rationale`, `expectedBusinessTypes`, and `confidence`, including their types, limits, and the three allowed `kind` values. Add the equivalent complete contract to the visual system prompt, including score ranges, finding fields, code and severity enums, and exactly three call angles.

Do not add response-shape guessing, parser coercion, or an automatic retry. Those alternatives can hide contract drift and spend extra API calls. The prompt contract is covered by a regression test that inspects the actual Anthropic request body.

## Verification

Each focused AI contract test must first fail against its incomplete prompt, then pass after the contract is added. The full prospecting suite, lint, and production build must remain green before redeployment. A new weekly cycle and an active-site audit will then validate the real Production Anthropic requests.
