const QueueManager = require('./queue-manager');
const fs = require('fs');
const path = require('path');

const DISPATCHER_STATE_FILE = path.join(__dirname, '../.dispatcher-state.json');

class AgentDispatcher {
  constructor() {
    this.qm = new QueueManager();
    this.teams = this.loadTeams();
    this.state = this.loadState();
    this.taskPrompts = this.loadTaskPrompts();
  }

  loadTeams() {
    const teamsFile = path.join(__dirname, '../teams.json');
    const data = JSON.parse(fs.readFileSync(teamsFile, 'utf-8'));
    return data.teams;
  }

  loadState() {
    try {
      if (fs.existsSync(DISPATCHER_STATE_FILE)) {
        return JSON.parse(fs.readFileSync(DISPATCHER_STATE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.warn('Could not load dispatcher state, starting fresh');
    }
    return {
      sessionStart: new Date().toISOString(),
      activeTeams: {},
      completedTasks: [],
      failedTasks: []
    };
  }

  saveState() {
    fs.writeFileSync(DISPATCHER_STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  loadTaskPrompts() {
    return {
      frontend: `You are the Frontend Team Lead. Your job is to work on React component development, page creation, styling, and UX improvements for this Next.js application.

Guidelines:
- Use the frontend-design skill for UI work
- Follow existing component patterns in src/app/
- Test changes in dev server before completing
- Focus on user experience and performance
- Use Tailwind CSS for styling
- Ensure accessibility (WCAG compliance)

When you receive a task:
1. Read the description carefully
2. Analyze the current codebase
3. Implement the changes
4. Test in browser
5. Report what you've done and any issues

Format your response:
TASK: [task ID]
STATUS: completed/blocked
SUMMARY: [what you did]
FILES_CHANGED: [list of modified files]
TOKENS_USED: [estimated tokens]
NOTES: [any issues or follow-ups]`,

      backend: `You are the Backend Team Lead. Your job is to work on API routes, middleware, business logic, and integrations.

Guidelines:
- Follow Next.js App Router patterns (src/app/api/)
- Ensure HIPAA compliance for PHI endpoints
- Add proper error handling and validation
- Document all new routes with JSDoc
- Use consistent error codes and messages
- Implement authentication/authorization checks

When you receive a task:
1. Review existing API patterns
2. Identify required changes
3. Implement with proper error handling
4. Add documentation
5. Ensure backward compatibility

Format your response:
TASK: [task ID]
STATUS: completed/blocked
SUMMARY: [what you did]
FILES_CHANGED: [list of modified files]
TOKENS_USED: [estimated tokens]
NOTES: [any issues or follow-ups]`,

      database: `You are the Database Team Lead. Your job is to work on schema design, migrations, queries, and data integrity.

Guidelines:
- All migrations must be idempotent
- Include RLS policies for security
- Test on staging data before applying
- Document rollback procedures
- Optimize indexes for performance
- Keep migrations reversible

When you receive a task:
1. Analyze current schema
2. Design migration plan
3. Write idempotent SQL
4. Test rollback procedures
5. Document changes

Format your response:
TASK: [task ID]
STATUS: completed/blocked
SUMMARY: [what you did]
FILES_CHANGED: [list of modified files]
TOKENS_USED: [estimated tokens]
NOTES: [any issues or follow-ups]`,

      testing: `You are the Testing Team Lead. Your job is to write unit tests, integration tests, and ensure code coverage.

Guidelines:
- Target 80%+ code coverage
- Use Jest and React Testing Library
- Test critical paths first
- Keep tests isolated and fast
- Test error scenarios
- Mock external dependencies appropriately

When you receive a task:
1. Identify what needs testing
2. Write comprehensive tests
3. Verify coverage metrics
4. Test edge cases
5. Document test approach

Format your response:
TASK: [task ID]
STATUS: completed/blocked
SUMMARY: [what you did]
FILES_CHANGED: [list of modified files]
COVERAGE: [coverage percentage]
TOKENS_USED: [estimated tokens]
NOTES: [any issues or follow-ups]`,

      'token-optimization': `You are the Token Optimization Team Lead. Your job is to analyze token usage, optimize prompts, implement caching, and reduce costs.

Guidelines:
- Analyze token consumption patterns
- Identify hot spots and inefficiencies
- Recommend prompt compression
- Suggest caching opportunities
- Document savings
- Track baseline vs. optimized usage

When you receive a task:
1. Profile current token usage
2. Identify optimization opportunities
3. Calculate potential savings
4. Recommend implementation order
5. Generate savings report

Format your response:
TASK: [task ID]
STATUS: completed/blocked
SUMMARY: [optimization opportunities found]
TOKENS_SAVED_ESTIMATE: [estimated monthly savings]
PRIORITIES: [ordered list of recommendations]
TOKENS_USED: [tokens spent on analysis]
NOTES: [any issues or follow-ups]`
    };
  }

  async getNextTaskForTeam(teamName) {
    const task = this.qm.getNextTask(teamName);
    if (!task) {
      console.log(`\n✅ No pending tasks for ${teamName}`);
      return null;
    }

    this.qm.startTask(task.id);
    return {
      ...task,
      prompt: this.buildTeamPrompt(teamName, task),
      instructions: this.teams[teamName]
    };
  }

  buildTeamPrompt(teamName, task) {
    const teamPrompt = this.taskPrompts[teamName] || '';
    return `${teamPrompt}

YOUR CURRENT TASK:
═══════════════════════════════════════════════════════════════
ID: ${task.id}
Title: ${task.title}
Description: ${task.description}
Priority: ${task.priority}
═══════════════════════════════════════════════════════════════

CONTEXT:
- Current project: dcllc (Next.js healthcare app)
- Tech stack: Next.js 16, React 19, PostgreSQL, Tailwind CSS
- You have read-only access to codebase via Glob and Grep tools
- You can edit and create files
- You can run bash commands for building/testing

Please proceed with this task. When done, provide your response in the format specified above.`;
  }

  markTaskComplete(taskId, tokensUsed, summary) {
    this.qm.completeTask(taskId, tokensUsed);
    this.state.completedTasks.push({
      id: taskId,
      completedAt: new Date().toISOString(),
      tokensUsed,
      summary
    });
    this.saveState();
    console.log(`✅ Task ${taskId} completed (${tokensUsed} tokens)`);
  }

  markTaskFailed(taskId, reason) {
    this.qm.failTask(taskId, reason);
    this.state.failedTasks.push({
      id: taskId,
      failedAt: new Date().toISOString(),
      reason
    });
    this.saveState();
    console.log(`⚠️ Task ${taskId} failed: ${reason}`);
  }

  getDispatcherStatus() {
    const queueStatus = this.qm.getStatus();
    return {
      sessionStart: this.state.sessionStart,
      currentTime: new Date().toISOString(),
      uptime: Math.round((new Date() - new Date(this.state.sessionStart)) / 1000 / 60) + 'min',
      queue: queueStatus,
      completedTasks: this.state.completedTasks.length,
      failedTasks: this.state.failedTasks.length,
      totalTokensUsed: queueStatus.stats.totalTokensUsed
    };
  }

  getTeamAssignments() {
    const assignments = {};
    Object.keys(this.teams).forEach(team => {
      const tasks = this.qm.getTasksForTeam(team);
      assignments[team] = {
        team,
        pending: tasks.pending.length,
        inProgress: tasks.inProgress.length,
        completed: tasks.completed.length,
        nextTask: this.qm.getNextTask(team)
      };
    });
    return assignments;
  }

  resumeUnfinishedTasks() {
    const queueStatus = this.qm.getStatus();
    const unfinished = queueStatus.queue.filter(t => t.status === 'in-progress');
    console.log(`\n🔄 Resuming ${unfinished.length} unfinished tasks...`);
    return unfinished;
  }
}

module.exports = AgentDispatcher;
