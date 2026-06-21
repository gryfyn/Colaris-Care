# Quick Start Guide - Auto-Commit & Development

## 5-Minute Setup

### Step 1: Configure Git Remote (if not already done)
```bash
git remote add origin https://github.com/YOUR_USERNAME/dcllc.git
git push -u origin master
```

### Step 2: Start Development
```bash
npm run dev
```
This starts the Next.js dev server on `http://localhost:3000`

### Step 3: Start Auto-Commit Agent
```bash
node scripts/auto-commit-on-limit.js &
```

You'll see:
```
[auto-commit] Agent started - monitoring for changes...
[auto-commit] Config: min files=2, check interval=5000ms
```

### Step 4: Work Normally
- Edit files in `src/`
- Create new components, pages, APIs
- Agent watches and auto-commits/pushes

## What Happens Behind the Scenes

```
You edit files
    ↓
Agent detects 2+ file changes (every 5 seconds)
    ↓
Agent stages all changes: git add src/ scripts/ db/
    ↓
Agent commits with auto-generated message
    ↓
Agent pushes to GitHub automatically
    ↓
Work is safe on remote ✅
```

## Monitoring

### Check what agent has committed
```bash
git log --oneline | head -20
```

You'll see:
```
a1b2c3d Auto-commit: context limit protection - src/app/staff/page.js, +2 more
9f8e7d6 Auto-commit: context limit protection - src/lib/auth.js, +1 more
8e7d6c5 Your manual commit message
```

### Check remote is updated
```bash
git log origin/master --oneline | head -20
```

Should match your local commits.

### View what the agent staged
```bash
git status
```

## Common Tasks

### Want to make a manual commit?
```bash
git commit -m "My manual commit message"
# Agent will still auto-commit/push on next cycle
```

### Want to temporarily stop auto-push?
```bash
# Press Ctrl+C to stop agent
# Fix any issues
# Restart: node scripts/auto-commit-on-limit.js &
```

### Want to check if changes reached GitHub?
```bash
# View remote history
git log origin/master --oneline

# Or open GitHub.com and view commits on your repo
```

### Want to adjust commit frequency?
Edit `scripts/auto-commit-on-limit.js`:
```javascript
const CHECK_INTERVAL = 5000;      // Check every 5 seconds
const MIN_FILES_CHANGED = 2;      // Commit when 2+ files changed
```

Then restart the agent.

## Emergency Shutdown

If you need to stop everything:
```bash
# Kill auto-commit agent
pkill -f auto-commit-on-limit.js

# Kill dev server
pkill -f "npm run dev"

# Check git status
git status

# All work is already committed and pushed ✅
```

## Troubleshooting

### Agent won't start
```bash
# Check Node version
node --version  # Should be v14+

# Check git is available
git --version

# Try starting in foreground (no &)
node scripts/auto-commit-on-limit.js
```

### Push keeps failing
```bash
# Check remote is set up
git remote -v

# Check GitHub credentials
git push origin master

# If that fails, see AUTO_COMMIT_GUIDE.md troubleshooting
```

### Lost track of what the agent did
```bash
# View recent commits
git log --oneline -20

# View what changed in last commit
git show --stat

# View full diff of last commit
git diff HEAD~1
```

## Pro Tips

✅ **Keep agent running** - It's safe and always in background

✅ **Check logs occasionally** - `git log --oneline` to see activity

✅ **Make manual commits too** - Agent + manual commits work together

✅ **Use git branches** - Agent works on any branch

❌ **Don't kill agent mid-push** - Let Ctrl+C finish gracefully

❌ **Don't use aggressive git operations** - Avoid `git reset --hard` while agent is running

## When to Use Each

| Scenario | Action |
|----------|--------|
| Active development | Start agent, just code |
| Before context limit reached | Agent auto-commits before compression |
| Major milestone | Manual commit + push |
| Need to stop work | Ctrl+C (final commit) |
| Fixing git issues | Stop agent, fix, restart |
| Checking progress | `git log --oneline` |

## Next Steps

1. ✅ Configure GitHub remote (once)
2. ✅ Start dev server: `npm run dev`
3. ✅ Start agent: `node scripts/auto-commit-on-limit.js &`
4. ✅ Code normally - agent handles the rest
5. ✅ Stop agent when done: `Ctrl+C`

All your work is automatically committed and pushed to GitHub!

---

**Need help?** See:
- `AUTO_COMMIT_GUIDE.md` - Full agent documentation
- `LOGIN_FLOW_GUIDE.md` - Authentication details
- `REBUILD_SUMMARY.md` - What was rebuilt
