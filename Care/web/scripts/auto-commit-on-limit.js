#!/usr/bin/env node
/**
 * Auto-commit agent that monitors token usage and commits before context is lost
 *
 * This agent runs in the background and:
 * 1. Monitors for changes in git working directory
 * 2. When significant changes accumulate, creates a commit
 * 3. Prevents loss of work by auto-saving before context compression
 *
 * Usage: node scripts/auto-commit-on-limit.js
 */

import { execSync } from 'child_process';
import { watch } from 'fs';
import { resolve } from 'path';

const PROJECT_ROOT = resolve('.');
const CHECK_INTERVAL = 5000; // Check every 5 seconds
const MIN_FILES_CHANGED = 2; // Commit when 2+ files changed
const EXCLUDED_PATTERNS = ['node_modules', '.next', '.git', 'dist', 'build'];

let lastCommitTime = Date.now();
let changeBuffer = new Set();
let isMonitoring = false;

function getGitStatus() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8', cwd: PROJECT_ROOT });
    return output
      .split('\n')
      .filter(line => line.trim())
      .map(line => line.slice(3));
  } catch {
    return [];
  }
}

function shouldExclude(filePath) {
  return EXCLUDED_PATTERNS.some(pattern => filePath.includes(pattern));
}

function getStagedChanges() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8', cwd: PROJECT_ROOT });
    return output.split('\n').filter(f => f.trim() && !shouldExclude(f));
  } catch {
    return [];
  }
}

function getUnstagedChanges() {
  try {
    const output = execSync('git diff --name-only', { encoding: 'utf-8', cwd: PROJECT_ROOT });
    return output.split('\n').filter(f => f.trim() && !shouldExclude(f));
  } catch {
    return [];
  }
}

function getUntrackedFiles() {
  try {
    const output = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8', cwd: PROJECT_ROOT });
    return output
      .split('\n')
      .filter(f => f.trim() && !shouldExclude(f));
  } catch {
    return [];
  }
}

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', cwd: PROJECT_ROOT }).trim();
  } catch {
    return 'main';
  }
}

function createAutoCommit() {
  try {
    const unstaged = getUnstagedChanges();
    const untracked = getUntrackedFiles();
    const allChanges = [...unstaged, ...untracked];

    if (allChanges.length === 0) {
      console.log('[auto-commit] No changes to commit');
      return false;
    }

    // Stage all changes
    console.log(`[auto-commit] Staging ${allChanges.length} file(s)...`);
    for (const file of allChanges) {
      try {
        execSync(`git add "${file}"`, { cwd: PROJECT_ROOT });
      } catch (e) {
        console.warn(`[auto-commit] Failed to stage ${file}: ${e.message}`);
      }
    }

    // Create commit
    const timestamp = new Date().toISOString();
    const fileList = allChanges.slice(0, 5).join(', ') + (allChanges.length > 5 ? ` +${allChanges.length - 5} more` : '');
    const message = `Auto-commit: context limit protection - ${fileList}

This commit was created automatically to prevent loss of work during context compression.
Timestamp: ${timestamp}
Files changed: ${allChanges.length}

Co-Authored-By: Auto-Commit Agent <agent@dependable-care.local>`;

    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: PROJECT_ROOT });
    console.log(`[auto-commit] ✓ Committed ${allChanges.length} file(s) at ${timestamp}`);

    // Push to remote
    pushToRemote();

    lastCommitTime = Date.now();
    changeBuffer.clear();
    return true;
  } catch (error) {
    console.error(`[auto-commit] Commit failed: ${error.message}`);
    return false;
  }
}

function pushToRemote() {
  try {
    const branch = getCurrentBranch();
    console.log(`[auto-commit] Pushing to remote/${branch}...`);

    execSync(`git push origin ${branch}`, {
      cwd: PROJECT_ROOT,
      stdio: 'pipe'
    });

    console.log(`[auto-commit] ✓ Pushed to remote/${branch}`);
  } catch (error) {
    const errorMsg = error.message || error.toString();

    // Check if it's a common error
    if (errorMsg.includes('Permission denied') || errorMsg.includes('authentication')) {
      console.error(`[auto-commit] ✗ Push failed: Authentication error`);
      console.error(`[auto-commit]   Fix: git config user.name and user.email, or check SSH/HTTPS credentials`);
    } else if (errorMsg.includes('no upstream') || errorMsg.includes('tracking')) {
      console.warn(`[auto-commit] ⚠ Push failed: No upstream branch`);
      console.warn(`[auto-commit]   Run: git push -u origin ${getCurrentBranch()}`);
    } else if (errorMsg.includes('rejected')) {
      console.warn(`[auto-commit] ⚠ Push rejected: Remote has changes`);
      console.warn(`[auto-commit]   Try: git pull origin ${getCurrentBranch()} first`);
    } else {
      console.error(`[auto-commit] ✗ Push failed: ${errorMsg.split('\n')[0]}`);
    }

    console.log(`[auto-commit] ℹ Changes are committed locally but not pushed to remote`);
    return false;
  }
}

function checkAndCommit() {
  const changes = getGitStatus();
  const changeCount = changes.length;

  if (changeCount >= MIN_FILES_CHANGED) {
    const timeSinceLastCommit = Date.now() - lastCommitTime;
    if (timeSinceLastCommit > 30000) { // 30 seconds since last commit
      console.log(`\n[auto-commit] Detected ${changeCount} changed file(s)`);
      createAutoCommit();
      return;
    }
  }

  // Log status if monitoring
  if (isMonitoring && changeCount > 0) {
    console.log(`[auto-commit] Watching ${changeCount} change(s)... (threshold: ${MIN_FILES_CHANGED})`);
  }
}

function startMonitoring() {
  isMonitoring = true;
  console.log('[auto-commit] Agent started - monitoring for changes...');
  console.log(`[auto-commit] Config: min files=${MIN_FILES_CHANGED}, check interval=${CHECK_INTERVAL}ms\n`);

  // Periodic check
  const intervalId = setInterval(() => {
    checkAndCommit();
  }, CHECK_INTERVAL);

  // File watcher
  const watcherPaths = [
    'src/',
    'scripts/',
    'db/',
  ];

  watcherPaths.forEach(path => {
    try {
      watch(resolve(PROJECT_ROOT, path), { recursive: true }, (eventType, filename) => {
        if (filename && !shouldExclude(filename)) {
          changeBuffer.add(filename);
        }
      });
    } catch (e) {
      console.warn(`[auto-commit] Could not watch ${path}: ${e.message}`);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[auto-commit] Shutting down gracefully...');
    clearInterval(intervalId);
    checkAndCommit(); // Final commit before exit
    console.log('[auto-commit] Agent stopped');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('[auto-commit] Received SIGTERM, committing remaining changes...');
    clearInterval(intervalId);
    checkAndCommit();
    console.log('[auto-commit] Agent stopped');
    process.exit(0);
  });
}

// Start the agent
startMonitoring();
