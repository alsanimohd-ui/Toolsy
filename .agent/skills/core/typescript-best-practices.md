---
name: typescript-best-practices
description: Core guidelines for creating type-safe and performant TypeScript applications.
source: https://github.com/VoltAgent/awesome-agent-skills
category: core
---

# TypeScript Best Practices Skill

Use this skill when writing, reviewing, or refactoring TypeScript code in the repository.

## Guardrails
- Avoid using `any` wherever possible. Use `unknown` or concrete types.
- Leverage structural typing and descriptive interface/type declarations.
- Enforce strict null checks for safety.
- Keep utilities pure and highly testable.

## Key Rules
1. Define clear props and responses for every function or component.
2. Prefer enums or literal types over magic strings or numbers.
3. Organize files by features, not purely by technical layers.
