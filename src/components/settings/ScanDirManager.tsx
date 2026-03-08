'use client';

import { useState, useEffect } from 'react';

interface ScanDir {
  id: number;
  path: string;
  label: string;
  slug: string;
  is_active: number;
}

export function ScanDirManager() {
  const [dirs, setDirs] = useState<ScanDir[]>([]);
  const [newPath, setNewPath] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPath, setEditPath] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchDirs = async () => {
    const res = await fetch('/api/scan-dirs');
    if (res.ok) setDirs(await res.json());
  };

  useEffect(() => { fetchDirs(); }, []);

  const showMessage = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
    setTimeout(() => { setError(null); setSuccess(null); }, 3000);
  };

  const handleAdd = async () => {
    if (!newPath.trim() || !newLabel.trim()) {
      showMessage('경로와 라벨을 모두 입력해주세요', true);
      return;
    }
    const res = await fetch('/api/scan-dirs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newPath.trim(), label: newLabel.trim() }),
    });
    if (res.ok) {
      setNewPath('');
      setNewLabel('');
      showMessage('스캔 디렉토리가 추가되었습니다');
      fetchDirs();
    } else {
      const data = await res.json();
      showMessage(data.error || '추가 실패', true);
    }
  };

  const handleUpdate = async (id: number) => {
    const res = await fetch('/api/scan-dirs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, path: editPath.trim(), label: editLabel.trim() }),
    });
    if (res.ok) {
      setEditingId(null);
      showMessage('수정되었습니다');
      fetchDirs();
    } else {
      const data = await res.json();
      showMessage(data.error || '수정 실패', true);
    }
  };

  const handleToggle = async (dir: ScanDir) => {
    await fetch('/api/scan-dirs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dir.id, is_active: !dir.is_active }),
    });
    fetchDirs();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 스캔 디렉토리를 삭제하시겠습니까?')) return;
    const res = await fetch('/api/scan-dirs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      showMessage('삭제되었습니다');
      fetchDirs();
    }
  };

  const startEdit = (dir: ScanDir) => {
    setEditingId(dir.id);
    setEditPath(dir.path);
    setEditLabel(dir.label);
  };

  return (
    <>
      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-sm text-danger">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-md text-sm text-success">
          {success}
        </div>
      )}

      <section className="bg-card border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">스캔 디렉토리</h2>

        <div className="space-y-2 mb-4">
          {dirs.map(dir => (
            <div key={dir.id}>
              {editingId === dir.id ? (
                <div className="bg-white/5 p-3 rounded-md space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={editPath}
                      onChange={e => setEditPath(e.target.value)}
                      placeholder="경로"
                      className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-xs font-mono focus:outline-none focus:border-accent"
                    />
                    <input
                      value={editLabel}
                      onChange={e => setEditLabel(e.target.value)}
                      placeholder="라벨"
                      className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs focus:outline-none focus:border-accent"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1 text-xs text-muted hover:text-foreground transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleUpdate(dir.id)}
                      className="px-3 py-1 text-xs bg-accent hover:bg-accent-hover text-white rounded transition-colors"
                    >
                      저장
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-2 bg-white/5 p-2.5 rounded-md group ${!dir.is_active ? 'opacity-50' : ''}`}>
                  <button
                    onClick={() => handleToggle(dir)}
                    className={`w-2 h-2 rounded-full shrink-0 ${dir.is_active ? 'bg-accent' : 'bg-muted/40'}`}
                    title={dir.is_active ? '활성 (클릭하여 비활성화)' : '비활성 (클릭하여 활성화)'}
                  />
                  <code className="text-muted font-mono text-xs flex-1 truncate">{dir.path}</code>
                  <span className="text-xs text-muted font-medium">{dir.label}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(dir)}
                      className="p-1 text-muted hover:text-foreground transition-colors"
                      title="편집"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(dir.id)}
                      className="p-1 text-muted hover:text-danger transition-colors"
                      title="삭제"
                    >
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M13.33 4v9.33a1.33 1.33 0 01-1.33 1.34H4a1.33 1.33 0 01-1.33-1.34V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {dirs.length === 0 && (
            <p className="text-xs text-muted text-center py-4">등록된 스캔 디렉토리가 없습니다</p>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-xs font-medium text-muted mb-2">디렉토리 추가</h3>
          <div className="flex gap-2">
            <input
              value={newPath}
              onChange={e => setNewPath(e.target.value)}
              placeholder="/경로/를/입력해주세요"
              className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-xs font-mono placeholder:text-muted/50 focus:outline-none focus:border-accent"
            />
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="라벨"
              className="w-28 px-2 py-1.5 bg-background border border-border rounded text-xs placeholder:text-muted/50 focus:outline-none focus:border-accent"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded transition-colors"
            >
              추가
            </button>
          </div>
          <p className="text-[10px] text-muted/60 mt-2">
            스캔 디렉토리 하위의 프로젝트 폴더를 자동으로 감지합니다. 추가 후 대시보드에서 &quot;프로젝트 스캔&quot;을 실행해주세요.
          </p>
        </div>
      </section>
    </>
  );
}
