const fs = require('fs');
const path = require('path');

const QUEUE_FILE = path.join(__dirname, '../work-queue.json');

class QueueManager {
  constructor() {
    this.queue = this.loadQueue();
  }

  loadQueue() {
    try {
      const data = fs.readFileSync(QUEUE_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load queue:', error);
      return { queue: [], completed: [], stats: { totalTasks: 0, completed: 0, inProgress: 0, pending: 0, totalTokensUsed: 0 } };
    }
  }

  saveQueue() {
    this.queue.lastUpdated = new Date().toISOString();
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2));
  }

  getNextTask(team) {
    const pending = this.queue.queue.filter(
      task => task.team === team && task.status === 'pending'
    );
    return pending.sort((a, b) => {
      const priorityMap = { high: 3, medium: 2, low: 1 };
      return priorityMap[b.priority] - priorityMap[a.priority];
    })[0] || null;
  }

  startTask(taskId) {
    const task = this.queue.queue.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'in-progress';
    task.startedAt = new Date().toISOString();
    task.assignedTo = `agent-${Date.now()}`;
    this.updateStats();
    this.saveQueue();
    return task;
  }

  completeTask(taskId, tokensUsed = 0) {
    const task = this.queue.queue.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.tokensUsed = tokensUsed;
    this.queue.completed.push(task);
    this.queue.queue = this.queue.queue.filter(t => t.id !== taskId);
    this.updateStats();
    this.saveQueue();
    return task;
  }

  failTask(taskId, reason = '') {
    const task = this.queue.queue.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'pending';
    task.assignedTo = null;
    task.startedAt = null;
    if (reason) task.failureReason = reason;
    this.updateStats();
    this.saveQueue();
    return task;
  }

  getStatus() {
    return {
      queue: this.queue.queue,
      completed: this.queue.completed.length,
      stats: this.queue.stats
    };
  }

  addTask(team, title, description, priority = 'medium') {
    const newTask = {
      id: `QUEUE-${String(this.queue.queue.length + this.queue.completed.length + 1).padStart(3, '0')}`,
      team,
      title,
      description,
      status: 'pending',
      priority,
      createdAt: new Date().toISOString(),
      assignedTo: null,
      startedAt: null,
      completedAt: null,
      tokensUsed: 0,
      githubIssue: null,
      subtasks: []
    };
    this.queue.queue.push(newTask);
    this.updateStats();
    this.saveQueue();
    return newTask;
  }

  updateStats() {
    this.queue.stats = {
      totalTasks: this.queue.queue.length + this.queue.completed.length,
      completed: this.queue.completed.length,
      inProgress: this.queue.queue.filter(t => t.status === 'in-progress').length,
      pending: this.queue.queue.filter(t => t.status === 'pending').length,
      totalTokensUsed: (this.queue.queue.concat(this.queue.completed)).reduce((sum, t) => sum + (t.tokensUsed || 0), 0)
    };
  }

  getTasksForTeam(team) {
    return {
      pending: this.queue.queue.filter(t => t.team === team && t.status === 'pending'),
      inProgress: this.queue.queue.filter(t => t.team === team && t.status === 'in-progress'),
      completed: this.queue.completed.filter(t => t.team === team)
    };
  }
}

module.exports = QueueManager;
