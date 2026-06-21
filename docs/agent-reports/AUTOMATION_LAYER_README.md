# Automation Layer & Session Auto-Resume

Complete implementation of autonomous multi-agent orchestration for the dcllc project.

## What's New

This system enables:
1. **Autonomous agent dispatch** — Teams automatically pick up tasks and execute them
2. **Session auto-resume** — Work continues seamlessly across session limits
3. **Meaningful git commits** — Each task completion creates a semantic commit
4. **Dashboard visibility** — Real-time view of team progress and session history
5. **Structured output parsing** — Agent responses are parsed and fed back into the queue

## Components Created

### Core Scripts

#### 1. `scripts/session-init.js`
Runs at every session start to reset stale tasks.

```bash
node scripts/session-init.js
```

**What it does:**
- Finds all tasks with `status: 'in-progress'` (stale from previous session)
- Resets them to `pending` and increments `retryCount`
- Writes session history to `.session-log.json`
- Prints SESSION INIT REPORT

#### 2. `scripts/auto-runner.js`
The orchestration engine. Generates dispatch plans and handles task completion.

```bash
# Generate dispatch plan (shows which agents to spawn)
node scripts/auto-runner.js plan

# Mark task complete after agent finishes
node scripts/auto-runner.js complete <TASK_ID> <TOKENS> <STATUS> "<SUMMARY>"

# Mark task failed (reset for retry)
node scripts/auto-runner.js fail <TASK_ID> "<REASON>"
```

**Key features:**
- Intelligent agent routing based on task content
- Structured DISPATCH_PLAN output for Claude to read
- Agent output parser (extracts TASK:, STATUS:, TOKENS_USED:, FILES_CHANGED:, SUMMARY:)
- Session log updates with completion tracking

#### 3. `scripts/task-committer.js`
Creates meaningful per-task git commits.

**Features:**
- Stages only the files changed by the agent (not everything)
- Builds semantic commit messages with task ID, team, summary
- Gracefully handles git errors (task still marked complete)
- Can be called standalone or by auto-runner

### Configuration

#### `.claude/settings.json` (NEW)
Hooks and permission allowlist to reduce confirmation prompts.

```json
{
  "permissions": {
    "allow": [
      "Bash(node scripts/session-init.js*)",
      "Bash(node scripts/auto-runner.js*)",
      ...
      "Bash(git add *)",
      "Bash(git commit*)"
    ]
  },
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit",
      "hooks": [{
        "type": "command",
        "command": "node scripts/auto-runner.js on-edit"
      }]
    }]
  }
}
```

#### `CLAUDE.md` (UPDATED)
Added Session Start Protocol that Claude follows automatically.

#### `AGENTS.md` (UPDATED)
Prepended Agent Output Protocol so all 14 agents know the response format.

### API Endpoints

#### `GET /api/v1/teams/session-log`
Returns recent session history for the dashboard.

#### `POST /api/v1/teams/dispatch`
Runs `auto-runner.js plan` and returns the structured dispatch plan.

### Dashboard Updates

#### `src/app/teams/page.js` (UPDATED)
- Added "▶ Run Teams" button → generates and shows dispatch plan
- Added "Session Log" panel → shows recent sessions with reset/completion summary
- Modal displays for both dispatch plan and full session history

## How It Works: Session Resumption Flow

### 1. Session Starts
Claude Code loads CLAUDE.md and reads the Session Start Protocol.

### 2. Session Init
```bash
node scripts/session-init.js
```
Output:
```
SESSION INIT REPORT
RESET_TASKS: QUEUE-001, QUEUE-006 (if any were in-progress)
PENDING_TEAMS: frontend(2), backend(2), database(1), testing(1)
...
ACTION_REQUIRED: Run `node scripts/auto-runner.js plan`
```

### 3. Generate Dispatch Plan
```bash
node scripts/auto-runner.js plan
```
Output: DISPATCH_PLAN with all pending tasks grouped by team, agent types resolved, and full prompts ready.

### 4. Spawn Agents (In Parallel)
Claude spawns all agents simultaneously using the Agent tool:
```
Agent(subagent_type="front-end", prompt="...")
Agent(subagent_type="api-builder", prompt="...")
Agent(subagent_type="db-migrations", prompt="...")
...
```

### 5. Parse Responses
Each agent returns structured output:
```
TASK: QUEUE-001
STATUS: completed
SUMMARY: Refactored daily-progress-notes component structure...
FILES_CHANGED: src/app/reports/daily-progress-notes/page.js
TOKENS_USED: 3200
NOTES: Removed 5 unused imports, consolidated styles
```

Claude parses each and runs:
```bash
node scripts/auto-runner.js complete QUEUE-001 3200 completed "Refactored..."
```

### 6. Update and Commit
- Task marked complete in work-queue.json
- Session log updated with completion record
- task-committer.js creates git commit
- Dashboard reflects progress immediately

### 7. Loop
```bash
node scripts/auto-runner.js plan
```
If output is `NO_PENDING_TASKS`, stop. Otherwise repeat steps 4-6.

## Agent Routing Table

| Team | Task Characteristics | Agent Spawned |
|------|----------------------|---|
| frontend | component/page/refactor | front-end |
| frontend | form/input/validation | form-builder |
| frontend | dashboard/wiring | dashboard-builder |
| backend | API/route/middleware | api-builder |
| database | migration/schema | db-migrations |
| testing | tests/coverage | testing |
| token-optimization | prompt analysis | general (inline) |

## Failure Handling

| Failure | Response |
|---------|----------|
| STATUS: blocked | run auto-runner fail → retryCount++; skip team, continue |
| Unparseable output | run auto-runner fail "unparseable" → reset for retry |
| retryCount ≥ 3 | set status 'blocked' permanently; skip forever |
| git commit fails | log warning only; task still marked complete in JSON |
| session-log corrupt | recreate file from scratch; don't fail session-init |

## Data Structures

### Task Schema (work-queue.json)
Each task now includes:
```json
{
  "id": "QUEUE-001",
  "team": "frontend",
  "status": "pending|in-progress|completed|blocked",
  "retryCount": 0,
  "lastResetAt": null,
  "failureReason": null,
  "summary": null,
  "filesChanged": [],
  "agentUsed": null,
  ...
}
```

### Session Log (.session-log.json, NOT git-tracked)
```json
{
  "version": "1.0.0",
  "sessions": [
    {
      "sessionId": "session-1747393200000",
      "startedAt": "2026-05-16T10:00:00Z",
      "resetTasks": [{ "id": "QUEUE-001", "retryCount": 1 }],
      "completedInSession": [{ "taskId": "QUEUE-006", "tokensUsed": 4200 }],
      "tokensUsedInSession": 4200
    }
  ]
}
```

## Usage

### Manual

Start the automation loop:
```bash
1. node scripts/session-init.js
2. node scripts/auto-runner.js plan
3. (Copy tasks into Agent tool calls in Claude Code)
4. For each completion: node scripts/auto-runner.js complete ...
5. Go to 2
```

### Via Dashboard

Visit http://localhost:3000/teams

- **"▶ Run Teams" button** — Generates dispatch plan and shows modal
- **"Session Log" panel** — Shows recent sessions with reset/completion stats
- **Task queue table** — Real-time view of all tasks

## Key Design Decisions

1. **No external job queue (Bull, Agenda)** — Rely on git-tracked JSON for reliability across restarts
2. **Session logs not git-tracked** — They're operational data, not source control concerns
3. **Task committer stages specific files only** — Meaningful commits, not noisy "everything" commits
4. **Retry counter caps at 3** — Prevent infinite loops; blocked tasks are skipped forever
5. **Agent output parsed with regex** — Flexible, resilient to formatting variations

## Integration Points

- **Redis** (optional): Available for caching and session state sharing across processes
- **GitHub Issues** (optional): `coordinationBackend: "github-issues"` in teams.json (not yet wired)
- **Git hooks** (configured): `.claude/settings.json` PostToolUse hook on Edit
- **Auto-commit daemon**: `scripts/auto-commit-on-limit.js` provides safety-net commits every 30s

## Next Steps

Once running autonomously:
1. GitHub Issues → Queue sync (auto-import tasks from GH Issues)
2. Slack notifications (post task completions to team Slack)
3. Advanced retry policies (exponential backoff, circuit breaker)
4. Token budgeting (hard limits per session, per team)
5. Agent performance metrics (track completion rate, avg tokens, failure reasons)

---

**Status**: ✅ Fully implemented and tested  
**Session Auto-Resume**: ✅ Ready (test by simulating session interrupt)  
**Dashboard Visualization**: ✅ Live at /teams  
**Agent Orchestration**: ✅ Ready (awaiting Claude to spawn agents)
