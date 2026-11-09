# WindWilly dashboard health

The status dashboard still checked the backend's former LAN port after it was
restricted to loopback on November 6, producing a false outage. Keep that binding
and proxy exact GET/HEAD `/api/health` through frontend nginx to backend `/health`.
Only the existing status JSON is exposed; other API authentication is unchanged.
POST is rejected and backend failures remain non-successful responses.

The operator requested WindWilly as the dashboard display name. That registration
and the canonical probe snapshot are maintained in MrMevius/homelab, not this
application repository. Existing repository, deployment and container identifiers
remain compatible.

Validation: `python3 scripts/test-health-proxy.py` exercises nginx with an isolated
mock backend, checking JSON, protected API access, rejected POST and backend failure.
`backend/.venv/bin/pytest -q backend/tests/test_meta_and_me.py` passed 25 tests.
Normal CI and production acceptance are required before reporting completion.
