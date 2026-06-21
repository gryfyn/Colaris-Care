const QueueManager = require('./queue-manager');
const AgentDispatcher = require('./dispatcher');
const { commitTaskCompletion } = require('./task-committer');
const fs = require('fs');
const path = require('path');

const SESSION_LOG_FILE = path.join(__dirname, '../.session-log.json');

// Team → Agent mapping based on task content
function resolveAgent(team, task) {
  const content = `${task.title} ${task.description}`.toLowerCase();

  if (team === 'frontend') {
    if (/dashboard|metric|widget|live data|wire/.test(content)) return 'dashboard-builder';
    if (/form|multi-step|input|field|validation|modal/.test(content)) return 'form-builder';
    return 'front-end';
  }

  if (team === 'security') {
    if (/architecture|threat|model|saas|compliance|soc2|gdpr|hipaa/.test(content)) return 'hipaa-compliance';
    if (/sql injection|api|auth|bypass|endpoint/.test(content)) return 'api-builder';
    if (/xss|csrf|frontend|javascript|client/.test(content)) return 'front-end';
    if (/encryption|data|pii|password|token/.test(content)) return 'general-purpose';
    return 'general-purpose';
  }

  const agentMap = {
    backend: 'api-builder',
    database: 'db-migrations',
    testing: 'testing'
  };

  return agentMap[team] || null;
}

function parseAgentOutput(rawText) {
  if (!rawText) return { parseError: true, reason: 'Empty response' };

  const result = {};

  // Extract each field via regex
  const taskMatch = rawText.match(/^TASK:\s*(.+?)$/m);
  result.taskId = taskMatch ? taskMatch[1].trim() : null;

  const statusMatch = rawText.match(/^STATUS:\s*(.+?)$/m);
  result.status = statusMatch ? statusMatch[1].trim().toLowerCase() : null;

  const tokensMatch = rawText.match(/^TOKENS_USED:\s*(\d+)/m);
  result.tokensUsed = tokensMatch ? parseInt(tokensMatch[1]) : 0;

  const filesMatch = rawText.match(/^FILES_CHANGED:\s*(.+?)$/m);
  result.filesChanged = filesMatch
    ? filesMatch[1].split(/[,\n]/).map(f => f.trim()).filter(f => f)
    : [];

  const summaryMatch = rawText.match(/^SUMMARY:\s*([\s\S]+?)(?=\n[A-Z_]+:|$)/m);
  result.summary = summaryMatch ? summaryMatch[1].trim() : 'Completed';

  const notesMatch = rawText.match(/^NOTES:\s*([\s\S]+?)$/m);
  result.notes = notesMatch ? notesMatch[1].trim() : '';

  // Validate required fields
  if (!result.taskId || !result.status) {
    return { parseError: true, reason: 'Missing TASK: or STATUS: field', raw: rawText };
  }

  if (!['completed', 'blocked'].includes(result.status)) {
    return { parseError: true, reason: `Invalid STATUS: ${result.status}` };
  }

  return result;
}

function loadSessionLog() {
  try {
    if (fs.existsSync(SESSION_LOG_FILE)) {
      return JSON.parse(fs.readFileSync(SESSION_LOG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.warn('Failed to load session log:', e.message);
  }
  return { version: '1.0.0', sessions: [] };
}

function saveSessionLog(log) {
  fs.writeFileSync(SESSION_LOG_FILE, JSON.stringify(log, null, 2));
}

function updateSessionLog(sessionId, taskId, tokensUsed) {
  const log = loadSessionLog();
  const session = log.sessions.find(s => s.sessionId === sessionId);

  if (session) {
    session.completedInSession.push({
      taskId,
      tokensUsed,
      completedAt: new Date().toISOString()
    });
    session.tokensUsedInSession += tokensUsed;
    saveSessionLog(log);
  }
}

function getCurrentSessionId() {
  const log = loadSessionLog();
  if (log.sessions.length === 0) return null;

  // Get the most recent session that doesn't have an endedAt
  const openSession = log.sessions.find(s => !s.endedAt);
  return openSession ? openSession.sessionId : null;
}

function buildDispatchPlan(qm, dispatcher) {
  const teams = ['security', 'frontend', 'backend', 'database', 'testing', 'token-optimization'];
  const tasks = [];

  // Get next task per team
  for (const team of teams) {
    const task = qm.getNextTask(team);
    if (task) {
      const agentType = resolveAgent(team, task);
      qm.startTask(task.id); // Mark as in-progress
      tasks.push({
        team,
        task,
        agentType,
        prompt: dispatcher.buildTeamPrompt(team, task)
      });
    }
  }

  if (tasks.length === 0) {
    return {
      hasTasks: false,
      output: '\n🎉 NO_PENDING_TASKS — Queue is empty, all work complete!\n'
    };
  }

  // Build DISPATCH_PLAN text for Claude
  let plan = '\n' + '═'.repeat(75) + '\n';
  plan += '  DISPATCH PLAN\n';
  plan += '═'.repeat(75) + '\n\n';
  plan += `Timestamp: ${new Date().toISOString()}\n`;
  plan += `Pending tasks to dispatch: ${tasks.length}\n\n`;

  plan += 'PARALLEL_AGENTS:\n';
  plan += '─'.repeat(75) + '\n\n';

  tasks.forEach((item, idx) => {
    plan += `[${idx + 1}/${tasks.length}]\n`;
    plan += `AGENT: ${item.agentType || 'general-purpose'}\n`;
    plan += `TASK_ID: ${item.task.id}\n`;
    plan += `TEAM: ${item.team}\n`;
    plan += `TITLE: ${item.task.title}\n`;
    plan += '\nPROMPT:\n';
    plan += '─'.repeat(75) + '\n';
    plan += item.prompt;
    plan += '\n' + '─'.repeat(75) + '\n\n';
  });

  plan += '═'.repeat(75) + '\n';
  plan += 'INSTRUCTIONS:\n';
  plan += '═'.repeat(75) + '\n';
  plan += `1. Spawn all ${tasks.length} agents SIMULTANEOUSLY using Agent tool:\n`;
  tasks.forEach((item, idx) => {
    plan += `   Agent(subagent_type="${item.agentType || 'claude'}", prompt="...")\n`;
  });
  plan += '\n2. Wait for all agents to complete.\n\n';
  plan += '3. Parse each agent response for structured fields:\n';
  plan += '   - TASK: <id>\n';
  plan += '   - STATUS: completed | blocked\n';
  plan += '   - SUMMARY: <description>\n';
  plan += '   - FILES_CHANGED: <comma-separated list>\n';
  plan += '   - TOKENS_USED: <integer>\n\n';
  plan += '4. For each completed agent, run:\n';
  plan += '   node scripts/auto-runner.js complete <TASK_ID> <TOKENS> <STATUS> "<SUMMARY>"\n\n';
  plan += '5. Loop: run `node scripts/auto-runner.js plan` again.\n';
  plan += '   If output is NO_PENDING_TASKS, stop.\n';
  plan += '═'.repeat(75) + '\n\n';

  return {
    hasTasks: true,
    tasks,
    output: plan
  };
}

function completeTask(taskId, tokensUsed, status, summary) {
  const qm = new QueueManager();

  if (status === 'blocked') {
    console.log(`⚠️  Task ${taskId} blocked. Resetting to pending for retry...`);
    qm.failTask(taskId, 'Blocked by agent');
  } else if (status === 'completed') {
    qm.completeTask(taskId, tokensUsed);
    console.log(`✅ Task ${taskId} marked completed (${tokensUsed} tokens)`);
  } else {
    console.error(`❌ Unknown status: ${status}`);
    return false;
  }

  // Update session log
  const sessionId = getCurrentSessionId();
  if (sessionId && status === 'completed') {
    updateSessionLog(sessionId, taskId, tokensUsed);
  }

  // Try to commit to git
  const task = qm.queue.completed.find(t => t.id === taskId) || qm.queue.queue.find(t => t.id === taskId);
  if (task) {
    task.summary = summary;
    task.tokensUsed = tokensUsed;
    qm.saveQueue();

    const { committed } = commitTaskCompletion(task, task.filesChanged || []);
    if (!committed) {
      console.log('   (but git commit failed — task still marked complete)');
    }
  }

  return true;
}

function failTask(taskId, reason) {
  const qm = new QueueManager();
  const task = qm.queue.queue.find(t => t.id === taskId);

  if (!task) {
    console.error(`❌ Task ${taskId} not found`);
    return false;
  }

  const retryCount = (task.retryCount || 0) + 1;

  if (retryCount >= 3) {
    console.log(`⚠️  Task ${taskId} has failed 3 times. Setting status to blocked.`);
    task.status = 'blocked';
    task.failureReason = `Blocked after 3 retries: ${reason}`;
  } else {
    console.log(`⚠️  Task ${taskId} failed (retry ${retryCount}/3): ${reason}`);
    qm.failTask(taskId, reason);
  }

  qm.saveQueue();
  return true;
}

// Main execution
const command = process.argv[2];

try {
  const qm = new QueueManager();
  const dispatcher = new AgentDispatcher();

  switch (command) {
    case 'plan':
      console.log('\n🔧 Building dispatch plan...\n');
      const plan = buildDispatchPlan(qm, dispatcher);
      console.log(plan.output);
      process.exit(0);
      break;

    case 'complete': {
      const taskId = process.argv[3];
      const tokensUsed = parseInt(process.argv[4]) || 0;
      const status = process.argv[5] || 'completed';
      const summary = process.argv[6] || '';

      if (!taskId) {
        console.error('Usage: auto-runner.js complete <taskId> <tokensUsed> <status> <summary>');
        process.exit(1);
      }

      const success = completeTask(taskId, tokensUsed, status, summary);
      process.exit(success ? 0 : 1);
      break;
    }

    case 'fail': {
      const taskId = process.argv[3];
      const reason = process.argv[4] || 'Unknown failure';

      if (!taskId) {
        console.error('Usage: auto-runner.js fail <taskId> <reason>');
        process.exit(1);
      }

      const success = failTask(taskId, reason);
      process.exit(success ? 0 : 1);
      break;
    }

    case 'on-edit': {
      // PostToolUse hook: log edits but don't commit yet
      const filePath = process.argv[3];
      if (filePath && filePath.includes('work-queue.json')) {
        console.log('📝 [auto-runner] Queue file modified by agent');
      }
      process.exit(0);
      break;
    }

    default:
      console.log(`\nUsage: auto-runner.js [command]

Commands:
  plan              Generate DISPATCH PLAN (shows which agents to spawn)
  complete <id> <tokens> <status> <summary>
                    Mark task complete after agent finishes
  fail <id> <reason>
                    Mark task failed, reset for retry
  on-edit           Hook called after file edits (internal use)
      `);
      process.exit(0);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
