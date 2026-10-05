# Gemini-specific notes

`.gemini/settings.json` loads `AGENTS.md` and this file as context. `AGENTS.md` holds the shared rules and is authoritative.

- Your agent id in changelog entries is `gemini`.
- Shared skills are in `.agents/skills/`, which Gemini CLI discovers as workspace skills. Activate `changelog` at the start of every task.
- Do not create Gemini-only rules here that change shared behavior. Put shared rules in `AGENTS.md` and log the change in `changelog/`.
- If you cannot run `npm` (sandbox or approval mode), record that in the entry's Verification section and add a `Needs human` item.
