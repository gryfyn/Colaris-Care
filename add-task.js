import fs from 'fs';

const workQueue = JSON.parse(fs.readFileSync('work-queue.json', 'utf8'));

// Generate new task ID
const lastTask = workQueue.tasks.sort((a, b) => {
  const aNum = parseInt(a.id.replace('QUEUE-', ''));
  const bNum = parseInt(b.id.replace('QUEUE-', ''));
  return bNum - aNum;
})[0];
const nextNum = parseInt(lastTask.id.replace('QUEUE-', '')) + 1;
const newTaskId = `QUEUE-${String(nextNum).padStart(3, '0')}`;

const debugTask = {
  id: newTaskId,
  title: "Debug Admin Page Data Display Issue",
  description: "The admin page has seeded data in the database (5 residents, 10 medications, 5 care plans, etc.) but the data is not showing on /admin. Debug and fix the issue. Steps: 1) Verify API endpoints return data when authenticated 2) Check if AuthContext is setting tokens correctly 3) Check if tenant_id is filtering data correctly 4) Verify RLS policies aren't blocking queries 5) Check browser console for errors 6) Test all sections (residents, care plans, medications, etc.). Root cause could be: auth token not being sent, tenant filtering issue, RLS policy blocking, component not loading data, or API endpoint errors.",
  team: "backend",
  agent_type: "api-builder",
  priority: "critical",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: "pending",
  depends_on: []
};

workQueue.tasks.push(debugTask);
fs.writeFileSync('work-queue.json', JSON.stringify(workQueue, null, 2));
console.log(`Created task: ${newTaskId}`);
console.log(debugTask.description);
