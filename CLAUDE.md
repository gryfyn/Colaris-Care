@AGENTS.md

## Session Start Protocol

**ALWAYS run this protocol first on every new session:**

```bash
1. node scripts/session-init.js
   → Resets any stale in-progress tasks to pending
   → Writes session history to .session-log.json
   → Prints SESSION INIT REPORT with pending tasks summary

2. node scripts/auto-runner.js plan
   → Generates DISPATCH PLAN
   → Shows which agents to spawn and their task prompts

3. Spawn all agents in PARALLEL_AGENTS section simultaneously:
   Agent(subagent_type="agent-type", prompt="...")
   Agent(subagent_type="agent-type", prompt="...")
   
4. Parse each agent's response for:
   - TASK: <id>
   - STATUS: completed | blocked
   - SUMMARY: <description>
   - FILES_CHANGED: <comma-separated list>
   - TOKENS_USED: <integer>

5. For each completed response, run:
   node scripts/auto-runner.js complete <TASK_ID> <TOKENS> <STATUS> "<SUMMARY>"

6. Loop:
   node scripts/auto-runner.js plan
   If output is "NO_PENDING_TASKS", stop. Otherwise go to step 3.
```

## Agent Routing Table

| Team | Task Characteristics | Agent to Spawn |
|------|----------------------|---|
| frontend | component/page/refactor | front-end |
| frontend | form/input/validation | form-builder |
| frontend | dashboard/wiring/data | dashboard-builder |
| backend | API/route/middleware | api-builder |
| database | migration/schema/query | db-migrations |
| testing | tests/coverage/spec | testing |
| token-optimization | prompt/cache/budget | general (inline) |
