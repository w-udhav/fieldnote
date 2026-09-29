# Job Scraper + Cold Emailer

A personal, local-first tool that finds startups that are hiring, learns about each company, and drafts short, honest cold emails for me to review and send.

Inspired by [MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search) (Claude Code framework). Same ideas, but built for cold outreach and run on a local LLM.

## Goal

Fix income first (Phase 1) by getting more interviews from early-to-growth startups and product-led SaaS in India, with less manual effort per application.

## Scope

**Build first:** job scraping + company enrichment.
**Build second:** cold email drafting, sending, follow-ups, tracking.

Non-goals: mass emailing, scraping behind logins, fully automated sending, anything that violates a site's terms.

## Core idea

Two modes, same data underneath:

| Mode | Input | Output |
| --- | --- | --- |
| `scrape search` | my profile + search queries | new matching jobs, deduped, with company info |
| `scrape company <url>` | a company URL or pasted text | enriched company record (for targets not on job boards) |

## Pipeline

1. **Discover**: source adapters return jobs in one common schema.
2. **Store**: SQLite, deduped, with `first_seen` so each run shows only new jobs.
3. **Filter**: cheap rules first (title, location, experience level).
4. **Enrich**: fetch the company site, extract clean text, local LLM returns structured JSON.
5. **Score**: fit against my profile and deal-breakers.
6. **(Later) Draft**: personalized email from verified facts only.
7. **(Later) Review + send**: I approve every email.
8. **(Later) Track**: status, follow-ups, replies.

## Sources (start simple)

- Greenhouse, Lever, Ashby public job-board APIs for a list of target startups
- Aggregators with public APIs or feeds
- Later, if terms allow: LinkedIn public listings at low volume for personal use
- Check robots.txt and terms per source. Skip login-walled boards (Wellfound, Instahyre, Cutshort) unless done manually.

## Common job schema

```
source, job_id, title, company, company_domain, location, remote,
url, description, posted_at, first_seen, scraped_at
```

## Company enrichment record

Every field stores the URL it came from.

```
company, domain, what_they_do, product, stage_guess,
tech_stack (from job description), recent_hook, sources[]
```

Rule: if a fact has no source URL, the email cannot use it.

## Tech stack

- Python: `httpx`, `trafilatura`, `sqlite3`
- Local LLM via Ollama (Llama 3.1 8B / Qwen 2.5 class), JSON-constrained output, low temperature
- Cron or GitHub Actions for scheduled runs (no always-on server)
- Fixtures of saved responses for offline tests

## Guardrails

- Polite scraping: rate limits, user agent, backoff on 429/5xx, cache pages
- Scraped text is untrusted data (delimit it, ignore instructions inside it)
- No invented facts: claims must trace to my profile or a fetched page
- Human approval before any email is sent
- Low daily send cap, max two follow-ups, easy opt-out line

## Phases

1. Schema + SQLite + Greenhouse and Lever adapters for 20-30 target startups
2. Company enrichment (fetch, extract, LLM JSON, source URLs)
3. Filtering + fit scoring with my profile
4. `scrape company <url>` mode
5. Scheduling + "new jobs only" daily output
6. Cold email drafting (drafter + reviewer passes), then send/track via Gmail API

## Lessons borrowed from the repo

- Knowledge in files (profile, writing style, projects), workflows as commands
- One small adapter per source with the same contract (`search`, `detail`)
- Score fit before writing anything
- Separate drafter and reviewer with fresh context
- Log outcomes and use them to improve targeting and templates

## Open questions

- Which 20-30 target startups go in the first list?
- Which extra sources are worth adding after Greenhouse/Lever?
- How to find contact emails legitimately (Hunter/Apollo free tiers, pattern + verification)?
- Which local model gives reliable JSON on my hardware?
