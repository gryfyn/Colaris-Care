const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const QUEUE_FILE = path.join(__dirname, '../work-queue.json');
const SESSION_LOG_FILE = path.join(__dirname, '../.session-log.json');

function loadQueue() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
  } catch (error) {
    console.error('Failed to load queue:', error.message);
    return null;
  }
}

function saveQueue(queue) {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function loadSessionLog() {
  try {
    if (fs.existsSync(SESSION_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_LOG_FILE, 'utf-8'));
    }
  } catch (error) {
    console.warn('Failed to load session log, starting fresh:', error.message);
  }
  return { version: '1.0.0', sessions: [], corruptedAt: null };
}

function saveSessionLog(log) {
  fs.writeFileSync(SESSION_LOG_FILE, JSON.stringify(log, null, 2));
}

function resetStaleTasks() {
  const queue = loadQueue();
  if (!queue) {
    console.error('Failed to load queue, aborting session init');
    process.exit(1);
  }

  const inProgress = queue.queue.filter(t => t.status === 'in-progress');

  if (inProgress.length === 0) {
    return { resetTasks: [], queue };
  }

  // Reset each in-progress task to pending
  inProgress.forEach(task => {
    task.status = 'pending';
    task.assignedTo = null;
    task.startedAt = null;
    task.lastResetAt = new Date().toISOString();
    task.failureReason = 'Session interrupted';
    task.retryCount = (task.retryCount || 0) + 1;
  });

  // Update stats
  queue.stats.inProgress = 0;
  queue.stats.pending = queue.queue.filter(t => t.status === 'pending').length;

  saveQueue(queue);
  return { resetTasks: inProgress, queue };
}

function writeSessionLog(resetTasks) {
  const log = loadSessionLog();
  const sessionId = `session-${Date.now()}`;

  log.sessions.push({
    sessionId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    resetTasks: resetTasks.map(t => ({
      id: t.id,
      team: t.team,
      title: t.title,
      retryCount: t.retryCount
    })),
    completedInSession: [],
    tokensUsedInSession: 0
  });

  saveSessionLog(log);
  return sessionId;
}

function emitResumptionReport(queue) {
  const teams = {};
  queue.queue.forEach(task => {
    if (!teams[task.team]) teams[task.team] = 0;
    if (task.status === 'pending') teams[task.team]++;
  });

  console.log('\n' + '═'.repeat(70));
  console.log('  SESSION INIT REPORT');
  console.log('═'.repeat(70));
  console.log(`Started at: ${new Date().toISOString()}`);

  const inProgress = queue.queue.filter(t => t.status === 'in-progress');
  if (inProgress.length > 0) {
    console.log(`\nRESET_TASKS: ${inProgress.map(t => t.id).join(', ')}`);
    inProgress.forEach(t => {
      console.log(`  • [${t.id}] ${t.title} (team: ${t.team}, retry#: ${t.retryCount})`);
    });
  } else {
    console.log('\n✅ No stale tasks — all sessions completed cleanly');
  }

  console.log('\nPENDING_TEAMS:');
  const pendingTeams = Object.entries(teams).sort((a, b) => b[1] - a[1]);
  if (pendingTeams.length === 0) {
    console.log('  (none — queue is empty)');
  } else {
    pendingTeams.forEach(([team, count]) => {
      console.log(`  • ${team}: ${count} pending`);
    });
  }

  console.log('\nQUEUE_STATS:');
  console.log(`  • Total tasks: ${queue.stats.totalTasks}`);
  console.log(`  • Pending: ${queue.stats.pending}`);
  console.log(`  • Completed: ${queue.stats.completed}`);
  console.log(`  • Total tokens used: ${queue.stats.totalTokensUsed}`);

  console.log('\nACTION_REQUIRED:');
  if (queue.stats.pending > 0) {
    console.log('  Run: node scripts/auto-runner.js plan');
    console.log('  Then spawn agents per DISPATCH PLAN');
  } else {
    console.log('  ✅ Queue is empty — all work complete');
  }
  console.log('═'.repeat(70) + '\n');
}

// Main flow
console.log('🔄 Session initialization starting...\n');

const { resetTasks, queue } = resetStaleTasks();
const sessionId = writeSessionLog(resetTasks);

console.log(`Session ID: ${sessionId}`);
console.log(`Reset ${resetTasks.length} stale task(s)`);

emitResumptionReport(queue);

process.exit(0);
