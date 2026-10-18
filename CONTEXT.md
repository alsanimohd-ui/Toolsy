# Toolsy

Toolsy is an offline-first workspace of utility tools for developer workflows, data analytics, and network security inspection.

## Language

**Tool**:
A standalone, self-contained functional utility that runs in the browser or on the local server.
_Avoid_: Widget, component, app, service

**SSRF (Server-Side Request Forgery)**:
A security vulnerability where a server is tricked into making requests to private, loopback, or internal networks.
_Avoid_: Request spoofing, internal scanner

**Port Checker**:
A tool to diagnose network connectivity, latency, and service availability on a target host and port.
_Avoid_: Port scanner, host ping

**API Request Lab**:
A developer workstation to construct, debug, and execute HTTP requests.
_Avoid_: REST client, request sender

**Local Scanner**:
A mechanism using browser sandboxed networking heuristics (e.g. latency checks on CORS failures) to check TCP port availability.
_Avoid_: Browser socket, client socket prober

**Regex Analyzer**:
A parser module that inspects regular expression patterns and compiles an English explanation list of their structural tokens.
_Avoid_: Pattern explainer, regex translator
