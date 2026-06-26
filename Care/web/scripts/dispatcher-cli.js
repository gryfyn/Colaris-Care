#!/usr/bin/env node
const AgentDispatcher = require('./dispatcher');

const dispatcher = new AgentDispatcher();
const command = process.argv[2];
const args = process.argv.slice(3);

function printHeader(title) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(70)}`);
}

function printDispatcherStatus() {
  const status = dispatcher.getDispatcherStatus();
  printHeader('DISPATCHER STATUS');

  console.log(`Session Start:     ${status.sessionStart}`);
  console.log(`Current Time:      ${status.currentTime}`);
  console.log(`Uptime:            ${status.uptime}`);
  console.log(`\nQueue Summary:`);
  console.log(`  • Total Tasks:   ${status.queue.stats.totalTasks}`);
  console.log(`  • Pending:       ${status.queue.stats.pending}`);
  console.log(`  • In Progress:   ${status.queue.stats.inProgress}`);
  console.log(`  • Completed:     ${status.queue.stats.completed}`);
  console.log(`\nResource Usage:`);
  console.log(`  • Total Tokens:  ${status.totalTokensUsed.toLocaleString()}`);
  console.log(`  • Completed:     ${status.completedTasks}`);
  console.log(`  • Failed:        ${status.failedTasks}`);
}

function printTeamAssignments() {
  const assignments = dispatcher.getTeamAssignments();
  printHeader('TEAM ASSIGNMENTS');

  Object.entries(assignments).forEach(([name, data]) => {
    const emoji = {
      frontend: '🎨',
      backend: '⚙️',
      database: '🗄️',
      testing: '✅',
      'token-optimization': '⚡'
    }[name] || '👥';

    console.log(`\n${emoji} ${name.toUpperCase()}`);
    console.log(`   Pending: ${data.pending} | In Progress: ${data.inProgress} | Completed: ${data.completed}`);
    if (data.nextTask) {
      console.log(`   Next: [${data.nextTask.id}] ${data.nextTask.title}`);
    } else {
      console.log(`   Next: ✅ None (all clear!)`);
    }
  });
}

async function dispatchNextTask(teamName) {
  if (!teamName) {
    console.log('\nUsage: dispatcher-cli dispatch <team-name>');
    console.log('Teams: frontend, backend, database, testing, token-optimization');
    return;
  }

  const task = await dispatcher.getNextTaskForTeam(teamName);
  if (!task) {
    return;
  }

  printHeader(`TASK ASSIGNED TO ${teamName.toUpperCase()}`);
  console.log(`\nID:       ${task.id}`);
  console.log(`Title:    ${task.title}`);
  console.log(`Priority: ${task.priority}`);
  console.log(`\nDescription:`);
  console.log(task.description);
  console.log(`\n${'─'.repeat(70)}`);
  console.log('TEAM PROMPT:');
  console.log(`${'─'.repeat(70)}`);
  console.log(task.prompt);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`This task is now IN PROGRESS. Team should respond with:`);
  console.log(`  TASK: ${task.id}`);
  console.log(`  STATUS: completed/blocked`);
  console.log(`  SUMMARY: [description of work done]`);
  console.log(`  FILES_CHANGED: [list of files]`);
  console.log(`  TOKENS_USED: [number]`);
  console.log(`${'═'.repeat(70)}\n`);
}

function resumeUnfinished() {
  printHeader('RESUMING UNFINISHED TASKS');
  const unfinished = dispatcher.resumeUnfinishedTasks();
  if (unfinished.length === 0) {
    console.log('No unfinished tasks to resume.');
    return;
  }

  unfinished.forEach(task => {
    const emoji = {
      frontend: '🎨',
      backend: '⚙️',
      database: '🗄️',
      testing: '✅',
      'token-optimization': '⚡'
    }[task.team] || '👥';

    console.log(`\n${emoji} [${task.id}] ${task.title}`);
    console.log(`   Team: ${task.team} | Status: ${task.status}`);
    console.log(`   Started: ${task.startedAt}`);
  });
}

function printHelp() {
  console.log(`
DISPATCHER CLI - Orchestrate autonomous team agents
═══════════════════════════════════════════════════════════

COMMANDS:
  status              Show dispatcher status and queue summary
  teams               Show all team assignments and next tasks
  dispatch <team>     Assign next task to a team
  resume              Resume any unfinished in-progress tasks
  help                Show this message

EXAMPLES:
  node scripts/dispatcher-cli.js status
  node scripts/dispatcher-cli.js teams
  node scripts/dispatcher-cli.js dispatch frontend
  node scripts/dispatcher-cli.js resume

TEAMS:
  • frontend          🎨 React components, pages, styling
  • backend           ⚙️  API routes, middleware, business logic
  • database          🗄️  Schema, migrations, queries
  • testing           ✅  Unit & integration tests
  • token-optimization ⚡ Token usage analysis & optimization
  `);
}

(async () => {
  switch (command) {
    case 'status':
      printDispatcherStatus();
      break;
    case 'teams':
      printTeamAssignments();
      break;
    case 'dispatch':
      await dispatchNextTask(args[0]);
      break;
    case 'resume':
      resumeUnfinished();
      break;
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
  }
})();
