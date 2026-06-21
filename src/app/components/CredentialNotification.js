'use client';
import { useState } from 'react';

export default function CredentialNotification({
  name,
  type = 'resident',
  username,
  password,
  onDismiss
}) {
  const [copied, setCopied] = useState({});

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopied({ ...copied, [field]: true });
    setTimeout(() => setCopied(prev => ({ ...prev, [field]: false })), 2000);
  };

  const typeLabel = type === 'staff' ? 'Staff Member' : 'Resident';
  const portalName = type === 'staff' ? 'Staff Portal' : 'Resident Portal';

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-white border-2 border-emerald-400 rounded-lg shadow-2xl p-5 z-50 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="text-2xl mt-1">🔑</div>
        <div className="flex-1">
          <div className="font-bold text-slate-900 mb-1">
            ✓ {typeLabel} Account Created
          </div>
          <div className="text-sm text-slate-700 mb-3">
            {name} can now log in to the {portalName}
          </div>

          {/* Credentials Display */}
          <div className="bg-slate-50 rounded p-3 space-y-2 mb-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-slate-800">
                Username: <strong>{username}</strong>
              </span>
              <button
                onClick={() => copyToClipboard(username, 'username')}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                {copied.username ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-slate-800">
                Password: <strong className="tracking-tight">{password}</strong>
              </span>
              <button
                onClick={() => copyToClipboard(password, 'password')}
                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                {copied.password ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 mb-3">
            ⚠️ Temporary password — {type === 'staff' ? 'Staff member' : 'Resident'} must change password on first login
          </div>

          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="flex-1 text-xs font-semibold text-slate-600 hover:text-slate-800 py-1.5 bg-slate-100 rounded hover:bg-slate-200"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                copyToClipboard(`Username: ${username}\nPassword: ${password}`, 'all');
              }}
              className="flex-1 text-xs font-semibold text-blue-600 hover:text-blue-800 py-1.5 bg-blue-50 rounded hover:bg-blue-100"
            >
              {copied.all ? 'Copied!' : 'Copy Both'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
