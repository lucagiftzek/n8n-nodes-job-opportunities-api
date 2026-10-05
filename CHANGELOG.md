# Changelog

All notable changes to this project are documented in this file.

## 0.1.0 (unreleased)

### Added

- Job Opportunities API credential (API key, Bearer authentication, tested against `GET /v1/me`).
- Job Opportunities API node: Job > Search, Get and Get Closed; Company > Search and Get; Account > Get Plan and Quota. Cursor pagination with Return All or Limit, a Simplify option, clear error messages for invalid keys, plan limits and rate limits. Usable as an AI Agent tool.
- Job Opportunities API Trigger (polling): New Job Matching Search (every plan), Job Change (Change Feed) and Job Closed (Growth and above).
