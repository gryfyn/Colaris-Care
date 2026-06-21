'use client';

import { useEffect, useState } from 'react';

const EMOJI_MAP = {
  frontend: '🎨',
  backend: '⚙️',
  database: '🗄️',
  testing: '✅',
  'token-optimization': '⚡'
};

const STATUS_COLOR = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-300',
  completed: 'bg-green-100 text-green-800 border-green-300',
  blocked: 'bg-red-100 text-red-800 border-red-300'
};

const PRIORITY_COLOR = {
  high: 'text-red-600 font-bold',
  medium: 'text-orange-600',
  low: 'text-green-600'
};

export default function TeamsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [error, setError] = useState(null);
  const [dispatchPlan, setDispatchPlan] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [sessionLog, setSessionLog] = useState(null);
  const [showSessionLog, setShowSessionLog] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/v1/teams/status');
        if (!response.ok) throw new Error('Failed to fetch');
        const json = await response.json();
        setData(json);
        setError(null);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleRunTeams = async () => {
    setPlanLoading(true);
    try {
      const response = await fetch('/api/v1/teams/dispatch', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to generate dispatch plan');
      const json = await response.json();
      setDispatchPlan(json);
      setShowPlanModal(true);
    } catch (err) {
      alert('Failed to generate dispatch plan: ' + err.message);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleShowSessionLog = async () => {
    try {
      const response = await fetch('/api/v1/teams/session-log');
      if (!response.ok) throw new Error('Failed to fetch session log');
      const json = await response.json();
      setSessionLog(json.sessions || []);
      setShowSessionLog(true);
    } catch (err) {
      alert('Failed to fetch session log: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="sticky top-0 z-10 border-b border-slate-700 bg-slate-900/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">👥</div>
              <div>
                <h1 className="text-2xl font-bold">Teams Dashboard</h1>
                <p className="text-sm text-slate-400">Autonomous software development teams</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm"
              >
                <option value={5000}>Refresh: 5s</option>
                <option value={10000}>Refresh: 10s</option>
                <option value={30000}>Refresh: 30s</option>
                <option value={60000}>Refresh: 1min</option>
              </select>
              <button
                onClick={handleRunTeams}
                disabled={planLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 rounded font-medium transition"
              >
                {planLoading ? '⏳ Generating...' : '▶ Run Teams'}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-medium transition"
              >
                Refresh Now
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Tasks', value: data?.stats?.totalTasks || '0', icon: '📋', color: 'from-blue-600 to-blue-400' },
            { label: 'Pending', value: data?.stats?.pending || '0', icon: '⏳', color: 'from-yellow-600 to-yellow-400' },
            { label: 'In Progress', value: data?.stats?.inProgress || '0', icon: '🔄', color: 'from-purple-600 to-purple-400' },
            { label: 'Completed', value: data?.stats?.completed || '0', icon: '✅', color: 'from-green-600 to-green-400' }
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-gradient-to-br ${stat.color} p-6 rounded-lg shadow-lg transform hover:scale-105 transition`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">{stat.label}</p>
                  <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                </div>
                <div className="text-4xl opacity-30">{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Token Usage */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span>⚡</span> Token Usage (Total: {data?.stats?.totalTokens || 0})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {['frontend', 'backend', 'database', 'testing', 'token-optimization'].map((team) => {
              const teamTasks = data?.queue?.queue?.filter((t) => t.team === team) || [];
              const teamTokens = teamTasks.reduce((sum, t) => sum + (t.tokensUsed || 0), 0);
              return (
                <div key={team} className="bg-slate-700/50 p-4 rounded border border-slate-600">
                  <div className="text-sm font-medium text-slate-400 mb-2">
                    {EMOJI_MAP[team]} {team.replace('-', ' ')}
                  </div>
                  <div className="text-2xl font-bold">{teamTokens}</div>
                  <div className="text-xs text-slate-500 mt-1">tokens used</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {['frontend', 'backend', 'database', 'testing', 'token-optimization'].map((team) => {
            const teamData = data?.teams?.[team] || { pending: 0, inProgress: 0, completed: 0 };
            const nextTask = data?.queue?.queue?.find((t) => t.team === team && t.status === 'pending');
            return (
              <div key={team} className="bg-slate-800 border border-slate-700 rounded-lg p-6 overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold flex items-center gap-2">
                    <span className="text-2xl">{EMOJI_MAP[team]}</span>
                    {team.replace('-', ' ').toUpperCase()}
                  </h3>
                  <div className="flex gap-2 text-sm">
                    <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 rounded border border-yellow-700">
                      {teamData.pending} pending
                    </span>
                    <span className="px-2 py-1 bg-blue-900/30 text-blue-300 rounded border border-blue-700">
                      {teamData.inProgress} active
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Next Task</p>
                    <p className="text-sm font-medium">
                      {nextTask ? `[${nextTask.id}] ${nextTask.title}` : 'No pending tasks'}
                    </p>
                  </div>

                  <div className="bg-slate-700/50 p-3 rounded border border-slate-600">
                    <p className="text-xs text-slate-400 mb-1">Status</p>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          teamData.inProgress > 0 ? 'bg-blue-400 animate-pulse' : 'bg-yellow-400'
                        }`}
                      ></div>
                      <span className="text-sm">
                        {teamData.inProgress > 0 ? 'Working...' : 'Idle - awaiting dispatch'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Task Queue Preview */}
        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">📋 Task Queue</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-slate-400">
                  <th className="text-left py-3 px-4">ID</th>
                  <th className="text-left py-3 px-4">Team</th>
                  <th className="text-left py-3 px-4">Task</th>
                  <th className="text-left py-3 px-4">Priority</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Tokens</th>
                </tr>
              </thead>
              <tbody>
                {(data?.queue?.queue || []).slice(0, 10).map((task) => (
                  <tr key={task.id} className="border-b border-slate-700/30 hover:bg-slate-700/30 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{task.id}</td>
                    <td className="py-3 px-4">{EMOJI_MAP[task.team]}</td>
                    <td className="py-3 px-4 text-slate-300">{task.title}</td>
                    <td className={`py-3 px-4 ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${STATUS_COLOR[task.status]}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">{task.tokensUsed || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Session Log */}
        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📋 Session Log</h2>
            <button
              onClick={handleShowSessionLog}
              className="text-sm px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition"
            >
              View All
            </button>
          </div>
          <div className="text-sm text-slate-400">
            {sessionLog && sessionLog.length > 0 ? (
              <div className="space-y-2">
                {sessionLog.slice(0, 3).map((session) => (
                  <div key={session.sessionId} className="flex items-center justify-between p-2 bg-slate-700/30 rounded border border-slate-600/50">
                    <span className="text-slate-300">{new Date(session.startedAt).toLocaleString()}</span>
                    <span className="text-xs text-slate-500">
                      {session.resetTasks?.length || 0} reset | {session.completedInSession?.length || 0} completed
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500">No sessions recorded yet</p>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">📍 Status</p>
            <p className="text-lg font-semibold">System Ready</p>
            <p className="text-xs text-slate-500 mt-2">All teams initialized and waiting for dispatch</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <p className="text-sm text-slate-400 mb-2">⚙️ Configuration</p>
            <p className="text-lg font-semibold">5 Teams Active</p>
            <p className="text-xs text-slate-500 mt-2">Frontend, Backend, Database, Testing, Token-Opt</p>
          </div>
        </div>
      </main>

      {/* Dispatch Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-4xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">🚀 Dispatch Plan</h3>
              <button
                onClick={() => setShowPlanModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              {dispatchPlan?.plan ? (
                <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-900/50 p-3 rounded border border-slate-700 overflow-x-auto">
                  {dispatchPlan.plan}
                </pre>
              ) : (
                <p className="text-slate-400">No plan generated</p>
              )}
            </div>
            <div className="border-t border-slate-700 p-4 flex gap-2">
              <button
                onClick={() => setShowPlanModal(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium transition"
              >
                Close
              </button>
              <a
                href="https://github.com/pablodelucca/pixel-agent"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded font-medium transition text-sm"
              >
                Reference Implementation →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Session Log Modal */}
      {showSessionLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg max-w-2xl w-full max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">📜 Session History</h3>
              <button
                onClick={() => setShowSessionLog(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              {sessionLog && sessionLog.length > 0 ? (
                sessionLog.map((session) => (
                  <div key={session.sessionId} className="border border-slate-600 rounded p-3 bg-slate-700/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-sm text-slate-300">{session.sessionId}</span>
                      <span className="text-xs text-slate-500">{new Date(session.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-slate-400 space-y-1">
                      <p>Reset: {session.resetTasks?.length || 0} tasks</p>
                      <p>Completed: {session.completedInSession?.length || 0} tasks</p>
                      <p>Tokens: {session.tokensUsedInSession || 0}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400">No sessions recorded yet</p>
              )}
            </div>
            <div className="border-t border-slate-700 p-4">
              <button
                onClick={() => setShowSessionLog(false)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
