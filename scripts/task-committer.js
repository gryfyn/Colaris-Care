const { execSync } = require('child_process');
const path = require('path');

function commitTaskCompletion(task, filesChanged = []) {
  if (!task || !task.id) {
    console.warn('⚠️ Invalid task object, skipping commit');
    return { committed: false, reason: 'Invalid task' };
  }

  // Clean up file paths
  const filesToAdd = filesChanged
    .filter(f => f && f.trim())
    .map(f => f.trim())
    .filter(f => !f.startsWith('node_modules') && f !== '.env' && f !== '.env.local');

  if (filesToAdd.length === 0) {
    console.log('ℹ️  No files to commit for this task');
    return { committed: false, reason: 'No files changed' };
  }

  try {
    // Stage the files
    execSync(`git add ${filesToAdd.map(f => `"${f}"`).join(' ')}`, {
      cwd: path.dirname(__dirname),
      stdio: 'pipe'
    });

    // Check if anything is actually staged
    let stagedOutput;
    try {
      stagedOutput = execSync('git diff --cached --name-only', {
        cwd: path.dirname(__dirname),
        encoding: 'utf-8'
      }).trim();
    } catch (e) {
      stagedOutput = '';
    }

    if (!stagedOutput) {
      console.log('ℹ️  No changes staged after git add');
      return { committed: false, reason: 'Nothing staged' };
    }

    // Build commit message
    const summary = task.summary || 'No summary provided';
    const filesLine = stagedOutput.split('\n').length > 1
      ? `${stagedOutput.split('\n').length} files`
      : stagedOutput;

    const commitMessage = `feat(${task.team}): complete ${task.id} - ${task.title}

Summary: ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}
Files: ${filesLine}
Tokens: ${task.tokensUsed || 0}

Co-Authored-By: ${task.agentUsed || 'Team'} Agent <agent@dcllc.local>`;

    // Commit
    execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
      cwd: path.dirname(__dirname),
      stdio: 'pipe'
    });

    console.log(`✅ Committed task ${task.id} (${task.team})`);
    return { committed: true, filesCommitted: stagedOutput.split('\n').length };
  } catch (error) {
    console.warn(`⚠️  Git commit failed for task ${task.id}:`);
    console.warn(`   ${error.message.split('\n')[0]}`);
    console.warn('   Task is still marked complete in queue.');
    return { committed: false, reason: error.message.substring(0, 100) };
  }
}

module.exports = { commitTaskCompletion };

// If run directly from CLI: node task-committer.js <taskId> <team> <title> <summary> <tokens>
if (require.main === module) {
  const [, , taskId, team, title, summary, tokensStr] = process.argv;

  if (!taskId || !team) {
    console.error('Usage: node task-committer.js <taskId> <team> <title> <summary> <tokens> [file1 file2 ...]');
    process.exit(1);
  }

  const filesChanged = process.argv.slice(7);
  const task = {
    id: taskId,
    team,
    title: title || 'Unknown',
    summary: summary || 'Completed',
    tokensUsed: parseInt(tokensStr) || 0,
    agentUsed: team
  };

  const result = commitTaskCompletion(task, filesChanged);
  process.exit(result.committed ? 0 : 1);
}
