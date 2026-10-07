# Translation

The **Translate** GitHub Actions workflow accepts a custom OpenAI Chat
Completions-compatible API. Configure these repository settings under
**Settings → Secrets and variables → Actions**:

| Kind     | Name                   | Value                                                  |
| -------- | ---------------------- | ------------------------------------------------------ |
| Variable | `TRANSLATION_BASE_URL` | API base URL, for example `https://api.example.com/v1` |
| Variable | `TRANSLATION_MODEL`    | A model name supported by that service                 |
| Secret   | `TRANSLATION_API_KEY`  | The service's API key                                  |

Base URL and model may also be repository secrets with the same names. If both
are set, the repository variable takes precedence. The API key must be a secret.

Use the base URL, not the full `/chat/completions` endpoint. The service must
support JSON translation responses. All three settings are required; missing
configuration stops the workflow instead of falling back to Mistral.

Run **Actions → Translate → Run workflow → Branch: dev** to translate dev
without merging into main. Automatic runs still follow main's existing English
locale/config changes. Runs commit generated locale files and `i18n.lock`
back to the selected branch, including completed work when another locale fails.
Partial failures still mark the workflow as failed. The output is also uploaded
as an artifact, so it remains recoverable if the commit or push fails.

Translations use three concurrent jobs by default. Set the optional repository
variable `TRANSLATION_CONCURRENCY` (1–10) to match the service's capacity. Runs
on the same branch are serialized to avoid competing translation commits.

`pnpm --filter @zntr/i18n translate` runs the same wrapper when the three
environment variables are provided. It preserves the locales and translation
prompt in `i18n.json`, temporarily substitutes the configured endpoint/model,
and restores the original configuration after the pinned Lingo CLI finishes.
The key is passed only through the environment. Lingo's OpenRouter adapter is
used for its Chat Completions transport and custom `baseUrl` support; an
OpenRouter account is not required.

The CLI is installed from the frozen workspace lockfile. Its provider is pinned
to the AI SDK 6-compatible stable adapter because the upstream alpha adapter
rejects otherwise valid Chat Completions responses from custom services.
