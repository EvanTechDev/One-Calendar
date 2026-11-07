# @zntr/i18n translation workflow

Translate calendar locale JSON with the pinned Lingo CLI and a custom OpenAI
Chat Completions-compatible API. The checked-in locale list and translation
prompt remain in `i18n.json`; endpoint overrides are temporary and credentials
are passed only through the environment.

## Configuration

Set these under **Settings → Secrets and variables → Actions**:

| Setting                   | Actions configuration                 | Purpose                                                    |
| ------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| `TRANSLATION_BASE_URL`    | Variable or secret; the variable wins | HTTP(S) API base URL, such as `https://api.example.com/v1` |
| `TRANSLATION_MODEL`       | Variable or secret; the variable wins | Model supported by that service                            |
| `TRANSLATION_API_KEY`     | Secret only                           | API credential, passed to Lingo through the environment    |
| `TRANSLATION_CONCURRENCY` | Optional variable                     | Concurrent translation jobs, from 1 to 10; defaults to 3   |

Translation and API diagnostics require the base URL, model, and API key.
Missing configuration fails instead of falling back to Mistral. Supply the base
URL, not its `/chat/completions` endpoint, and use a service that returns JSON
translation responses.

## GitHub Actions

Pushes to `main` run **Translate** when `i18n.json` or the English calendar
locale changes. For any branch, use **Actions → Translate → Run workflow** and
select the target branch; generated locale files and `i18n.lock` are committed
back to that branch.

| Dispatch input  | Behavior                                                                     |
| --------------- | ---------------------------------------------------------------------------- |
| `locales`       | Comma-separated targets; empty processes every configured target             |
| `concurrency`   | Per-run override from 1 to 10; takes precedence over the repository variable |
| `checksum_ref`  | Earlier commit SHA used only with explicit locales for a partial retry       |
| `lockfile_only` | Validate completed translations and rebuild checksums without API calls      |
| `diagnose`      | Inspect the API response structure without translating or committing output  |

Runs on the same branch are serialized without cancelling the active run, so
translation commits do not race. Non-diagnostic locale and lockfile output is
also uploaded as an artifact.

### Partial retries

Enter only the locales to retry, for example `bn,el,zh-HK`, and optionally set
`concurrency` to `1`. Unknown targets fail validation.

If an older run advanced `i18n.lock` despite a partial failure, set
`checksum_ref` to that run's source commit SHA. The wrapper temporarily uses
that committed lockfile so changed existing strings are eligible alongside
missing keys. A checksum reference requires explicit locales, and every
targeted retry restores the current lockfile afterward.

### Lockfile-only refresh

Select `lockfile_only` after completing translations manually. The workflow
checks every target locale for missing keys, structural mismatches,
placeholders, and protected names, then runs:

```sh
bun x --no-install lingo.dev lockfile --force
```

Lingo generates its own checksums without contacting the translation API or
rewriting locale content.

## Local translation

Install workspace dependencies first, then run from the repository root:

```sh
TRANSLATION_BASE_URL=https://api.example.com/v1 \
TRANSLATION_API_KEY=your-api-key \
TRANSLATION_MODEL=your-model \
bun run --filter @zntr/i18n translate
```

Optional environment variables mirror workflow dispatch:
`TRANSLATION_CONCURRENCY`, `TRANSLATION_LOCALES`, and
`TRANSLATION_CHECKSUM_REF`. The local wrapper runs the same pinned CLI through
`bun x --no-install`. Its OpenRouter adapter supplies Chat Completions
transport and custom `baseUrl` support; an OpenRouter account is not required.

## Concurrency and failures

- Lingo defaults to three concurrent jobs; values outside 1–10 are rejected.
- The wrapper always restores the original `i18n.json` after the CLI exits.
- A failed full run restores the previous `i18n.lock`, while completed locale
  files remain available. Targeted runs restore the lockfile on success too.
- After a translation failure, Actions still uploads the output and attempts
  to commit completed work, but the workflow remains failed. The artifact
  remains recoverable if the later commit or push fails.
- Local failures return a non-zero exit status; they do not create commits.
