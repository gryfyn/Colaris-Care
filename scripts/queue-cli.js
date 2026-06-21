#!/usr/bin/env node
const QueueManager = require('./queue-manager');
const fs = require('fs');
const path = require('path');

const qm = new QueueManager();
const command = process.argv[2];
const args = process.argv.slice(3);

function printStatus() {
  const status = qm.getStatus();
  console.log('\n📊 QUEUE STATUS');
  console.log('═'.repeat(60));
  console.log(`Total Tasks: ${status.stats.totalTasks} | Pending: ${status.stats.pending} | In Progress: ${status.stats.inProgress} | Completed: ${status.stats.completed}`);
  console.log(`Total Tokens Used: ${status.stats.totalTokensUsed.toLocaleString()}`);
  console.log('═'.repeat(60));

  if (status.queue.length === 0) {
    console.log('\n✅ All tasks completed!');
    return;
  }

  console.log('\n📋 QUEUE (sorted by priority):');
  const byTeam = {};
  status.queue.forEach(task => {
    if (!byTeam[task.team]) byTeam[task.team] = [];
    byTeam[task.team].push(task);
  });

  Object.entries(byTeam).forEach(([team, tasks]) => {
    console.log(`\n  ${team.toUpperCase()}`);
    tasks.forEach(task => {
      const status_badge = task.status === 'in-progress' ? '🔄' : '⏳';
      console.log(`    ${status_badge} [${task.id}] ${task.title} (${task.priority})`);
    });
  });
}

function printTeamStatus(team) {
  const tasks = qm.getTasksForTeam(team);
  console.log(`\n📊 ${team.toUpperCase()} TEAM STATUS`);
  console.log('═'.repeat(60));

  if (tasks.pending.length === 0 && tasks.inProgress.length === 0 && tasks.completed.length === 0) {
    console.log('No tasks assigned.');
    return;
  }

  if (tasks.inProgress.length > 0) {
    console.log('\n🔄 IN PROGRESS:');
    tasks.inProgress.forEach(t => console.log(`  [${t.id}] ${t.title}`));
  }

  if (tasks.pending.length > 0) {
    console.log('\n⏳ PENDING:');
    tasks.pending.forEach(t => console.log(`  [${t.id}] ${t.title}`));
  }

  if (tasks.completed.length > 0) {
    console.log(`\n✅ COMPLETED (${tasks.completed.length}):`);
    tasks.completed.slice(-5).forEach(t => {
      console.log(`  [${t.id}] ${t.title} (${t.tokensUsed} tokens)`);
    });
    if (tasks.completed.length > 5) {
      console.log(`  ... and ${tasks.completed.length - 5} more`);
    }
  }
}

function nextTask(team) {
  const task = qm.getNextTask(team);
  if (!task) {
    console.log(`\n✅ No pending tasks for ${team}`);
    return;
  }
  qm.startTask(task.id);
  console.log(`\n✨ Next task for ${team}:`);
  console.log(`ID: ${task.id}`);
  console.log(`Title: ${task.title}`);
  console.log(`Description: ${task.description}`);
  console.log(`Priority: ${task.priority}`);
}

function completeTask(taskId, tokens = 0) {
  qm.completeTask(taskId, parseInt(tokens) || 0);
  console.log(`\n✅ Task ${taskId} completed! (${tokens} tokens used)`);
}

function failTask(taskId) {
  qm.failTask(taskId);
  console.log(`\n⚠️ Task ${taskId} marked as pending (reset for retry)`);
}

function addTask(team, title) {
  if (!team || !title) {
    console.log('Usage: npm run queue:add <team> <title>');
    return;
  }
  const task = qm.addTask(team, title, 'Auto-added task', 'medium');
  console.log(`\n✅ Task created: ${task.id} - ${title}`);
}

function tokenReport() {
  const status = qm.getStatus();
  const teams = {};

  status.queue.concat(qm.queue.completed).forEach(task => {
    if (!teams[task.team]) teams[task.team] = { count: 0, tokens: 0 };
    teams[task.team].count++;
    teams[task.team].tokens += task.tokensUsed || 0;
  });

  console.log('\n💰 TOKEN USAGE REPORT');
  console.log('═'.repeat(60));
  Object.entries(teams).forEach(([team, data]) => {
    const avg = Math.round(data.tokens / data.count);
    console.log(`${team.padEnd(20)} | Tasks: ${String(data.count).padStart(3)} | Tokens: ${String(data.tokens).padStart(8)} | Avg/Task: ${avg}`);
  });
  console.log('═'.repeat(60));
  console.log(`TOTAL TOKENS USED: ${status.stats.totalTokensUsed.toLocaleString()}`);
}

switch (command) {
  case 'status':
    printStatus();
    break;
  case 'team':
    if (!args[0]) {
      console.log('Usage: queue-cli team <team-name>');
    } else {
      printTeamStatus(args[0]);
    }
    break;
  case 'next':
    if (!args[0]) {
      console.log('Usage: queue-cli next <team-name>');
    } else {
      nextTask(args[0]);
    }
    break;
  case 'complete':
    if (!args[0]) {
      console.log('Usage: queue-cli complete <task-id> [tokens]');
    } else {
      completeTask(args[0], args[1]);
    }
    break;
  case 'fail':
    if (!args[0]) {
      console.log('Usage: queue-cli fail <task-id>');
    } else {
      failTask(args[0]);
    }
    break;
  case 'add':
    if (args.length < 2) {
      console.log('Usage: queue-cli add <team> <title>');
    } else {
      addTask(args[0], args.slice(1).join(' '));
    }
    break;
  case 'tokens':
    tokenReport();
    break;
  case 'help':
  default:
    console.log(`
QUEUE CLI COMMANDS:
  status              Show overall queue status
  team <name>         Show tasks for specific team
  next <team>         Get next task for team and mark in-progress
  complete <id> [t]   Mark task complete with optional token count
  fail <id>           Reset task to pending (for retry)
  add <team> <title>  Add new task to queue
  tokens              Show token usage report
  help                Show this message
    `);
}
