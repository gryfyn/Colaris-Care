# Auto-Commit Agent Guide

## Purpose

The auto-commit agent prevents loss of work by automatically committing changes before context compression. When you're working on large features and the Claude session approaches its token limit, this agent ensures your work is safely committed to git.

## How It Works

```
┌─────────────────────────────────────┐
│  File Changes Detected              │
│  - Modified files                   │
│  - New files                        │
│  - Deleted files                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Threshold Check                    │
│  - 2+ files changed?                │
│  - 30+ seconds since last commit?   │
└──────────────┬──────────────────────┘
               │
       Yes ◄───┴───► No (continue monitoring)
               │
               ▼
┌─────────────────────────────────────┐
│  Auto-Commit Process                │
│  1. Stage all changes               │
│  2. Create descriptive commit       │
│  3. Push to git                     │
│  4. Reset monitoring buffers        │
└─────────────────────────────────────┘
```

## Setup & Usage

### 1. Configure Git Remote (One-time setup)

Before first use, ensure your git remote is configured:

```bash
# Check if remote exists
git remote -v

# If not, add it
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Set up tracking for current branch
git push -u origin master  # or main, develop, etc.
```

### 2. Start the Agent in Background
```bash
node scripts/auto-commit-on-limit.js &
```

Or in a separate terminal:
```bash
node scripts/auto-commit-on-limit.js
```

### 3. Agent Will Monitor & Push
```
[auto-commit] Agent started - monitoring for changes...
[auto-commit] Config: min files=2, check interval=5000ms

[auto-commit] Watching 3 change(s)... (threshold: 2)
[auto-commit] Detected 5 changed file(s)
[auto-commit] Staging 5 file(s)...
[auto-commit] ✓ Committed 5 file(s) at 2026-05-15T09:30:45.123Z
[auto-commit] Pushing to remote/master...
[auto-commit] ✓ Pushed to remote/master
```

The agent now:
1. ✅ Detects changes
2. ✅ Commits to local git
3. ✅ Automatically pushes to GitHub

### 4. Continue Working
The agent runs in the background. You continue developing normally. Every time 2+ files change, it auto-commits and pushes to remote.

### 5. Stop the Agent
Press `Ctrl+C` to gracefully shut down:
```
[auto-commit] Received SIGINT, committing remaining changes...
[auto-commit] ✓ Pushed to remote/master
[auto-commit] Agent stopped
```

## Configuration

Edit `scripts/auto-commit-on-limit.js` to adjust thresholds:

```javascript
const CHECK_INTERVAL = 5000;      // Check every 5 seconds
const MIN_FILES_CHANGED = 2;      // Commit when 2+ files changed
const EXCLUDED_PATTERNS = [       // Ignore these paths
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build'
];
```

### Recommended Settings

| Scenario | CHECK_INTERVAL | MIN_FILES | Notes |
|----------|---|---|---|
| Active development | 5000ms | 2-3 | Commits frequently |
| Large refactor | 10000ms | 5-10 | Batches changes |
| Cleanup/polish | 3000ms | 1 | Commits everything |

## What Gets Committed

### Included
- ✓ Modified source files (`src/`)
- ✓ New script files (`scripts/`)
- ✓ Database migrations (`db/`)
- ✓ Configuration changes

### Excluded (Auto-ignored)
- ✗ `node_modules/` (dependencies)
- ✗ `.next/` (build output)
- ✗ `.git/` (git metadata)
- ✗ `dist/` and `build/` (generated files)

## Commit Message Format

Auto-commits use this format:
```
Auto-commit: context limit protection - file1.js, file2.js, +3 more

This commit was created automatically to prevent loss of work during context compression.
Timestamp: 2026-05-15T09:30:45.123Z
Files changed: 5

Co-Authored-By: Auto-Commit Agent <agent@dependable-care.local>
```

This makes it easy to:
- Identify auto-commits in git history
- See what changed and when
- Distinguish from manual commits

## Integration with Claude Sessions

### Workflow

1. **Start new session** → Start agent immediately
2. **Work on code** → Agent monitors silently
3. **Approaching context limit?** → Agent auto-commits before compression
4. **Session reloads** → All work is safely in git
5. **Continue in new session** → Pull latest and resume

### Benefits

| Problem | Solution |
|---------|----------|
| Lost work due to context compression | Auto-commits before compression |
| Unclear git history | Descriptive auto-commit messages |
| Manual commit management | Fully automated |
| Large file overwrite risk | Git history preserves all versions |

## Example Session

```
$ npm run dev &
$ node scripts/auto-commit-on-limit.js &

[Dev server starts]
[Auto-commit agent starts monitoring]

> [You work on src/app/staff/page.js]
[auto-commit] Watching 1 change(s)...

> [You create scripts/test-login.mjs]
[auto-commit] Watching 2 change(s)...
[auto-commit] Detected 2 changed file(s)
[auto-commit] Staging 2 file(s)...
[auto-commit] ✓ Committed 2 file(s) at 2026-05-15T09:35:12.456Z

> [You modify src/app/login/page.js]
[auto-commit] Watching 1 change(s)...

> [You create src/lib/auth-utils.js]
[auto-commit] Detected 2 changed file(s)
[auto-commit] ✓ Committed 2 file(s) at 2026-05-15T09:36:45.789Z

... work continues safely ...

^C
[auto-commit] Received SIGINT, committing remaining changes...
[auto-commit] ✓ Committed 1 file(s) at 2026-05-15T09:45:00.000Z
[auto-commit] Agent stopped
```

## Troubleshooting

### Agent not committing
1. Check git status: `git status`
2. Verify changes exist in src/, scripts/, db/
3. Check if excluded patterns are hiding your changes
4. Increase verbosity in script to debug

### Push failures

**Authentication Error:**
```
[auto-commit] ✗ Push failed: Authentication error
```
Fix:
```bash
# Set git credentials
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Or set up SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"
# Add public key to GitHub
```

**No upstream branch:**
```
[auto-commit] ⚠ Push failed: No upstream branch
```
Fix:
```bash
git push -u origin master
```

**Remote has changes (rejected):**
```
[auto-commit] ⚠ Push rejected: Remote has changes
```
Fix:
```bash
git pull origin master
# Resolve any conflicts
# Agent will push next cycle
```

### Too many commits
1. Increase `CHECK_INTERVAL` (more seconds = less frequent checks)
2. Increase `MIN_FILES_CHANGED` (require more files to commit)

### Agent consuming resources
- It uses file watchers (lightweight)
- Runs git checks every 5 seconds
- Minimal CPU impact
- Negligible memory footprint

### Disabling auto-push temporarily
If you need to stop pushes (e.g., fixing conflicts):
1. Stop the agent: `Ctrl+C`
2. Resolve git issues: `git pull`, `git merge`, etc.
3. Restart the agent

Work remains committed locally and will push on next cycle.

## Best Practices

✅ **DO:**
- Start agent at beginning of session
- Run in background (`&` or separate terminal)
- Stop gracefully with `Ctrl+C` (final commit)
- Review git log occasionally: `git log --oneline`

❌ **DON'T:**
- Run multiple agents (they'll compete)
- Kill the process harshly (might miss final commit)
- Modify agent config during active work (requires restart)
- Rely on auto-commits as backup (commit manually for important milestones)

## Advanced

### Custom Commit Hooks
Modify the `createAutoCommit()` function to:
- Notify team
- Update issue trackers
- Trigger CI/CD
- Send alerts

### Integration with IDE
Some IDEs can run tasks automatically:
- VSCode: Add to `tasks.json`
- JetBrains: Add as External Tool
- Vim/Emacs: Add to shell startup

### CI/CD Integration
Detect auto-commits to trigger different actions:
```bash
if git log -1 --pretty=%b | grep -q "Auto-commit"; then
  # Run quick tests
  npm test -- --bail
fi
```
