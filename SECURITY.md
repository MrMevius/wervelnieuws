# Security Policy

## Supported version

Security fixes are applied to the current `main` branch. Older commits and deployments are not maintained as separate supported versions.

## Reporting a vulnerability

Do not disclose exploitable security issues, credentials, tokens, private data, or detailed attack instructions in a public issue.

When private vulnerability reporting is available for this repository, use GitHub's private vulnerability reporting flow. Otherwise, contact the repository owner through GitHub first and share technical details only through an agreed private channel.

Please include, where possible:

- a concise description of the issue;
- affected component or endpoint;
- reproduction steps using non-sensitive test data;
- expected and observed behavior;
- potential impact;
- any suggested mitigation.

Do not include production credentials, real user data, session cookies, access tokens, database contents, or other secrets in a report.

## Security-sensitive changes

Security fixes should preserve existing behavior unless the vulnerability requires a behavioral change. Relevant automated tests must be added or updated, and credentials or other secrets must never be committed to the repository.
