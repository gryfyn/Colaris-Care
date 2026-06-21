#!/usr/bin/env node
const QueueManager = require('./queue-manager');
const AgentDispatcher = require('./dispatcher');
const fs = require('fs');

const qm = new QueueManager();
const dispatcher = new AgentDispatcher();

const command = process.argv[2];
const args = process.argv.slice(3);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printBox(title) {
  console.log('\n' + colorize('═'.repeat(70), 'cyan'));
  console.log(colorize(`  ${title}`, 'bright'));
  console.log(colorize('═'.repeat(70), 'cyan'));
}

function dashboard() {
  const status = qm.getStatus();
  const dispatcherStatus = dispatcher.getDispatcherStatus();

  console.clear();
  printBox('📊 TEAMS DASHBOARD');

  console.log('\n' + colorize('QUEUE STATUS:', 'bright'));
  console.log(`  Total: ${status.stats.totalTasks} | Pending: ${colorize(status.stats.pending, 'yellow')} | In Progress: ${colorize(status.stats.inProgress, 'blue')} | Completed: ${colorize(status.stats.completed, 'green')}`);
  console.log(`  Tokens Used: ${colorize(status.stats.totalTokensUsed.toString(), 'magenta')}`);

  console.log('\n' + colorize('TEAMS OVERVIEW:', 'bright'));
  const teamEmojis = {
    frontend: '🎨',
    backend: '⚙️',
    database: '🗄️',
    testing: '✅',
    'token-optimization': '⚡'
  };

  const assignments = dispatcher.getTeamAssignments();
  Object.entries(assignments).forEach(([name, data]) => {
    const emoji = teamEmojis[name];
    const statusBar = '█'.repeat(data.inProgress) + '░'.repeat(data.pending);
    console.log(`  ${emoji} ${name.padEnd(20)} │ ${colorize(statusBar.padEnd(20), 'blue')} │ ✓${data.completed}`);
  });

  console.log('\n' + colorize('QUEUE PREVIEW (Next 5):', 'bright'));
  status.queue.slice(0, 5).forEach((task) => {
    const emoji = teamEmojis[task.team] || '•';
    const statusColor = task.status === 'pending' ? 'yellow' : task.status === 'in-progress' ? 'blue' : 'green';
    console.log(`  ${emoji} [${task.id}] ${task.title.padEnd(40)} ${colorize(task.status, statusColor)}`);
  });

  console.log('\n' + colorize('DISPATCHER INFO:', 'bright'));
  console.log(`  Uptime: ${dispatcherStatus.uptime}`);
  console.log(`  Session: ${new Date(dispatcherStatus.sessionStart).toLocaleString()}`);

  console.log('\n' + colorize('💡 TIP:', 'green') + ' Run: npm run teams:watch');
}

function watch() {
  dashboard();
  setInterval(dashboard, 2000);
}

function summary() {
  const status = qm.getStatus();

  printBox('📋 WORK QUEUE SUMMARY');

  console.log('\n' + colorize('By Team:', 'bright'));
  const teamEmojis = {
    frontend: '🎨',
    backend: '⚙️',
    database: '🗄️',
    testing: '✅',
    'token-optimization': '⚡'
  };

  Object.keys(teamEmojis).forEach((team) => {
    const tasks = qm.getTasksForTeam(team);
    const total = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
    console.log(`\n  ${teamEmojis[team]} ${team.toUpperCase()}`);
    console.log(`     Pending: ${tasks.pending.length} | In Progress: ${tasks.inProgress.length} | Done: ${tasks.completed.length} (Total: ${total})`);
    if (tasks.inProgress.length > 0) {
      tasks.inProgress.forEach((t) => {
        console.log(`       🔄 [${t.id}] ${t.title}`);
      });
    }
  });

  console.log('\n' + colorize('Priority Breakdown:', 'bright'));
  const byPriority = { high: 0, medium: 0, low: 0 };
  status.queue.forEach((t) => {
    byPriority[t.priority]++;
  });
  console.log(`  High: ${colorize(byPriority.high, 'red')} | Medium: ${colorize(byPriority.medium, 'yellow')} | Low: ${colorize(byPriority.low, 'green')}`);
}

function tokens() {
  const status = qm.getStatus();
  const allTasks = status.queue.concat(qm.queue.completed);

  printBox('⚡ TOKEN USAGE REPORT');

  const byTeam = {};
  allTasks.forEach((task) => {
    if (!byTeam[task.team]) byTeam[task.team] = { tasks: 0, tokens: 0 };
    byTeam[task.team].tasks++;
    byTeam[task.team].tokens += task.tokensUsed || 0;
  });

  console.log('\n' + colorize('By Team:', 'bright'));
  Object.entries(byTeam)
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .forEach(([team, data]) => {
      const avg = Math.round(data.tokens / data.tasks);
      const pct = ((data.tokens / status.stats.totalTokensUsed) * 100).toFixed(1);
      console.log(`  ${team.padEnd(20)} │ Tasks: ${String(data.tasks).padStart(3)} │ Tokens: ${String(data.tokens).padStart(8)} │ Avg: ${avg.toString().padStart(6)} │ ${pct}%`);
    });

  console.log('\n' + colorize('TOTAL:', 'bright') + ` ${colorize(status.stats.totalTokensUsed, 'magenta')} tokens`);

  if (status.stats.totalTokensUsed > 0) {
    const avgPerTask = Math.round(status.stats.totalTokensUsed / status.stats.totalTasks);
    console.log(`Average per task: ${avgPerTask} tokens`);
  }
}

function quick() {
  const status = qm.getStatus();
  const assignments = dispatcher.getTeamAssignments();

  console.log('\n' + colorize('QUICK STATUS', 'bright'));
  console.log(`Tasks: ${colorize(status.stats.pending, 'yellow')}p ${colorize(status.stats.inProgress, 'blue')}w ${colorize(status.stats.completed, 'green')}✓ | Tokens: ${colorize(status.stats.totalTokensUsed, 'magenta')}`);

  Object.entries(assignments).forEach(([name, data]) => {
    if (data.pending > 0 || data.inProgress > 0) {
      console.log(`${name}: ${data.pending}p ${data.inProgress}w`);
    }
  });
  console.log();
}

function printHelp() {
  printBox('TEAMS CLI - Manage autonomous agent teams');

  console.log(`
COMMANDS:
  ${colorize('dashboard', 'cyan')}        Show live dashboard (auto-refresh)
  ${colorize('watch', 'cyan')}           Live dashboard with 2s refresh
  ${colorize('summary', 'cyan')}         Queue summary by team
  ${colorize('tokens', 'cyan')}          Token usage report
  ${colorize('quick', 'cyan')}           One-line status
  ${colorize('help', 'cyan')}            Show this help

EXAMPLES:
  npm run teams:dashboard          # Full dashboard
  npm run teams:watch              # Live watch mode
  npm run teams:tokens             # Token report
  `);
}

switch (command) {
  case 'dashboard':
    dashboard();
    break;
  case 'watch':
    watch();
    break;
  case 'summary':
    summary();
    break;
  case 'tokens':
    tokens();
    break;
  case 'quick':
    quick();
    break;
  case 'help':
  case undefined:
    printHelp();
    break;
  default:
    console.log(`Unknown command: ${command}`);
    printHelp();
}
