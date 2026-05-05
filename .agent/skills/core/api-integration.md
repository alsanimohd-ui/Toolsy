---
name: api-integration
description: Guidelines for integrating external APIs (REST, GraphQL, etc.) securely and efficiently.
source: https://github.com/VoltAgent/awesome-agent-skills
category: core
---

# API Integration Skill

Use this skill when developing or debugging code that integrates with external services.

## Guardrails
- Always validate responses before processing.
- Avoid exposing API keys or secrets in source control.
- Implement rate-limiting and retry logic for robustness.
- Wrap third-party API calls in clean, reusable adapter/service functions.

## Implementation Guidelines
1. Store keys in environment variables (`.env`).
2. Use strong types for API responses when using TypeScript.
3. Handle timeouts and downstream errors gracefully.
