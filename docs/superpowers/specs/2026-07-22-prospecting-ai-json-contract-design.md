# Prospecting AI JSON Contract Design

## Problem

The weekly territory prompt asks Anthropic for JSON but does not state the required property names, types, or `kind` enum. Production therefore accepted a valid JSON object that could not pass the existing Zod schema, leaving the first cycle in `FAILED` before any Google calls were made. The visual-audit prompt had the same omission for nested finding codes and severity values, so the first active-site audit reached Anthropic but failed validation.

## Decision

Keep the existing strict Zod parsers and fail-fast behavior. Add the complete top-level response contract to the territory system prompt: `displayName`, `city`, `kind`, `searchQuery`, `rationale`, `expectedBusinessTypes`, and `confidence`, including their types, limits, and the three allowed `kind` values. Add the equivalent complete contract to the visual system prompt, including score ranges, finding fields, code and severity enums, and exactly three call angles.

Prompt instructions alone are not the enforcement boundary: a real Haiku 4.5 visual call still returned HTTP 200 with a response that failed validation. Both Messages API calls therefore also send Anthropic `output_config.format` with `type: "json_schema"` and a schema equivalent to the local Zod contract. Zod remains a second validation boundary after constrained decoding.

Do not add response-shape guessing, parser coercion, or an automatic retry. Those alternatives can hide contract drift and spend extra API calls. Regression tests inspect both the semantic system prompts and the exact structured-output schemas in the actual Anthropic request bodies.

## Verification

Each focused AI contract test must first fail against its incomplete prompt, then pass after the contract is added. The full prospecting suite, lint, and production build must remain green before redeployment. A new weekly cycle and an active-site audit will then validate the real Production Anthropic requests.
