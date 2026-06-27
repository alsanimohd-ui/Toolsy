# PRD: Local Browser Port Scanner

## Problem Statement

As a network administrator or developer inspecting a system locally (on my own machine or internal network), I want to scan service availability and port configurations directly from the browser without sending target host data or network traffic through an external server. Previously, selecting the "Local (Browser)" mode did not perform any scans, leaving the feature completely non-functional.

## Solution

Implement client-side port scanning using browser sandboxed networking heuristics. The browser connection prober initiates TCP check requests via `fetch` with short timeouts and analyses connection latency to determine if local services are listening, closed, or firewalled.

## User Stories

1. As a network engineer, I want to toggle between Local and Remote scan modes, so that I can choose the appropriate network scan vector.
2. As a local developer, I want to scan port 8080 on localhost, so that I can confirm my local development server is running and accepting connections.
3. As a developer, I want to scan multiple ports (e.g., "80, 443") in local mode, so that I can audit multiple local services sequentially.
4. As a user scanning locally, I want to receive a clean warning if I attempt a UDP scan, so that I understand UDP scanning is technically unsupported inside browser sandboxes.
5. As a network auditor, I want a local scan timeout setting, so that I can control how long the browser hangs on filtered ports before assuming a timeout.
6. As a developer, I want local scan latency statistics, so that I can understand network round-trip time for local services.

## Implementation Decisions

We implemented the Local Scanner module to probe TCP ports using latency-based heuristics:

- **Local Scanner Module**: A client-side helper library that parses input ports (comma-separated lists and ranges) and sequentially probes each target port.
- **Fetch Probing Heuristic**: Initiates a `no-cors` fetch request to `http://<host>:<port>`. 
  - If it succeeds or fails with a CORS error taking >= 35ms, the port is identified as `OPEN`.
  - If it fails instantly with a TypeError in < 35ms, the port is identified as `CLOSED` (TCP RST).
  - If it times out or takes longer than the configured timeout duration, the port is identified as `TIMEOUT` (Filtered).
- **UDP Prevention**: Immediately returns a structured scan error status for any UDP request, bypassing fetch probing.

## Testing Decisions

- **Good Test Criteria**: Test external behavior of the parser and prober by mock-asserting latency and error types, avoiding real network traffic.
- **Tested Modules**: The local port scanner module will be fully tested.
- **Prior Art**: Mocking global fetch for testing sandboxed utility features is established in the workspace test suites.

## Out of Scope

- UDP socket scanning (technically impossible within sandboxed web browsers).
- Raw TCP handshake inspection (browsers do not expose low-level TCP/IP headers).
- Local hostname lookup (CORS limitations prevent resolving custom local domain names without network fetch).

## Further Notes

Local mode scans are subject to standard mixed-content policies in browsers. Mixed-content security warnings in the console are expected when loading HTTP links from an HTTPS context.
