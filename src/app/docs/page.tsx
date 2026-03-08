'use client';

import { useState, useEffect, useCallback } from 'react';

interface DocFile {
  name: string;
  exists: boolean;
  size: number | null;
  path: string;
}

interface DocLevel {
  level: 'global' | 'workspace' | 'project';
  label: string;
  dirPath: string;
  id?: string;
  group_name?: string;
  files: DocFile[];
}

interface EditorState {
  filePath: string;
  fileName: string;
  levelLabel: string;
  content: string;
  original: string;
  isNew: boolean;
}

const LEVEL_META = {
  global: { icon: '🌐', desc: '모든 Claude Code 세션에 적용' },
  workspace: { icon: '📁', desc: '하위 모든 프로젝트에 적용' },
  project: { icon: '📦', desc: '해당 프로젝트에만 적용' },
} as const;

export default function DocsPage() {
  const [levels, setLevels] = useState<DocLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ file: DocFile; label: string } | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/docs');
      if (res.ok) setLevels(await res.json());
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleOpen = async (file: DocFile, label: string) => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: file.path }),
    });
    if (res.ok) {
      const { content, isNew } = await res.json();
      setEditor({
        filePath: file.path,
        fileName: file.name,
        levelLabel: label,
        content,
        original: content,
        isNew,
      });
    }
  };

  const handleSave = async () => {
    if (!editor) return;
    setSaving(true);
    try {
      const res = await fetch('/api/docs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: editor.filePath, content: editor.content }),
      });
      if (res.ok) {
        setEditor({ ...editor, original: editor.content, isNew: false });
        showToast('저장됨');
        fetchDocs();
      }
    } catch { /* */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (file: DocFile) => {
    try {
      const res = await fetch('/api/docs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.path }),
      });
      if (res.ok) {
        showToast('삭제됨');
        fetchDocs();
        setDeleteConfirm(null);
      }
    } catch { /* */ }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const hasChanges = editor ? editor.content !== editor.original : false;

  // 데이터 분류
  const globalLevel = levels.find(l => l.level === 'global');
  const workspaceLevels = levels.filter(l => l.level === 'workspace');
  const projectLevels = levels.filter(l => l.level === 'project');

  // 프로젝트를 워크스페이스별로 묶기
  const projectsByWorkspace = new Map<string, DocLevel[]>();
  for (const ws of workspaceLevels) {
    projectsByWorkspace.set(ws.label, []);
  }
  for (const proj of projectLevels) {
    const ws = workspaceLevels.find(w => proj.dirPath.startsWith(w.dirPath));
    const key = ws?.label || '기타';
    if (!projectsByWorkspace.has(key)) projectsByWorkspace.set(key, []);
    projectsByWorkspace.get(key)!.push(proj);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AI 설정</h1>
        <p className="text-sm text-muted">로딩 중...</p>
      </div>
    );
  }

  // 에디터
  if (editor) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-48px)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (hasChanges && !confirm('저장하지 않은 변경사항이 있습니다. 나가시겠습니까?')) return;
                setEditor(null);
              }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← 목록
            </button>
            <div>
              <h1 className="text-lg font-bold">{editor.levelLabel}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-muted">{editor.fileName}</span>
                {editor.isNew && (
                  <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">새 파일</span>
                )}
                {hasChanges && (
                  <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded">수정됨</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted hidden sm:inline">
              {editor.filePath.replace(/^\/Users\/[^/]+\//, '~/')}
            </span>
            <button
              onClick={() => setEditor({ ...editor, content: editor.original })}
              disabled={!hasChanges}
              className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-muted rounded transition-colors disabled:opacity-30"
            >
              되돌리기
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="text-xs px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent rounded transition-colors disabled:opacity-30"
            >
              {saving ? '저장 중...' : editor.isNew ? '생성' : '저장'}
            </button>
          </div>
        </div>

        <textarea
          value={editor.content}
          onChange={e => setEditor({ ...editor, content: e.target.value })}
          placeholder={`# ${editor.fileName}\n\n프로젝트 지침을 작성하세요.`}
          spellCheck={false}
          className="flex-1 w-full bg-card border border-border rounded-lg p-4 text-sm font-mono text-foreground resize-none focus:outline-none focus:border-accent/50 placeholder:text-muted/40"
          onKeyDown={e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
              e.preventDefault();
              if (hasChanges) handleSave();
            }
          }}
        />
      </div>
    );
  }

  // 목록
  const totalFiles = levels.reduce((sum, l) => sum + l.files.filter(f => f.exists).length, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 설정</h1>
        <p className="text-sm text-muted mt-1">
          CLAUDE.md · AGENTS.md — {totalFiles}개 파일 관리 중
        </p>
      </div>

      <div className="space-y-4">
        {/* 전역 */}
        {globalLevel && (
          <LevelSection
            icon={LEVEL_META.global.icon}
            title="전역"
            desc={LEVEL_META.global.desc}
            items={[globalLevel]}
            onOpen={handleOpen}
            onDelete={(file, label) => setDeleteConfirm({ file, label })}
            showPath
          />
        )}

        {/* 워크스페이스 + 하위 프로젝트 */}
        {workspaceLevels.map(ws => {
          const projects = projectsByWorkspace.get(ws.label) || [];
          return (
            <section key={ws.dirPath} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* 워크스페이스 헤더 */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{LEVEL_META.workspace.icon}</span>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {ws.label}
                  </h2>
                  <span className="text-[10px] text-muted">{LEVEL_META.workspace.desc}</span>
                </div>
              </div>

              {/* 워크스페이스 루트 파일 */}
              <div className="border-b border-border/50 bg-white/[0.01]">
                <DocRow
                  label={`${ws.label} (루트)`}
                  files={ws.files}
                  pathStr={ws.dirPath}
                  indent={0}
                  onOpen={handleOpen}
                  onDelete={(file, label) => setDeleteConfirm({ file, label })}
                />
              </div>

              {/* 프로젝트들 */}
              {projects.length > 0 && (
                <div className="divide-y divide-border/30">
                  {projects.map(proj => (
                    <DocRow
                      key={proj.id}
                      label={proj.label}
                      files={proj.files}
                      pathStr={proj.dirPath}
                      indent={1}
                      onOpen={handleOpen}
                      onDelete={(file, label) => setDeleteConfirm({ file, label })}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 삭제 확인 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-sm font-bold mb-2">파일 삭제</h3>
            <p className="text-xs text-muted mb-4">
              <span className="font-mono text-foreground">{deleteConfirm.label}/{deleteConfirm.file.name}</span>을 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-muted rounded transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.file)}
                className="text-xs px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-success/90 text-white text-xs px-3 py-2 rounded-md shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트 ───

function LevelSection({
  icon, title, desc, items, onOpen, onDelete, showPath,
}: {
  icon: string;
  title: string;
  desc: string;
  items: DocLevel[];
  onOpen: (file: DocFile, label: string) => void;
  onDelete: (file: DocFile, label: string) => void;
  showPath?: boolean;
}) {
  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-xs">{icon}</span>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
          <span className="text-[10px] text-muted">{desc}</span>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {items.map(item => (
          <DocRow
            key={item.dirPath}
            label={item.label}
            files={item.files}
            pathStr={showPath ? item.dirPath : undefined}
            indent={0}
            onOpen={onOpen}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  );
}

function DocRow({
  label, files, pathStr, indent, onOpen, onDelete,
}: {
  label: string;
  files: DocFile[];
  pathStr?: string;
  indent: number;
  onOpen: (file: DocFile, label: string) => void;
  onDelete: (file: DocFile, label: string) => void;
}) {
  const hasAny = files.some(f => f.exists);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors ${
        !hasAny ? 'opacity-50' : ''
      }`}
      style={indent > 0 ? { paddingLeft: `${16 + indent * 20}px` } : undefined}
    >
      {indent > 0 && (
        <span className="text-muted/30 text-xs select-none">└</span>
      )}

      <span className="text-sm font-medium text-foreground min-w-[140px] truncate">
        {label}
      </span>

      <div className="flex-1 flex items-center gap-2">
        {files.map(file => (
          <div key={file.name} className="flex items-center gap-1">
            <button
              onClick={() => onOpen(file, label)}
              className={`text-xs font-mono px-2 py-1 rounded transition-colors ${
                file.exists
                  ? 'bg-success/10 text-success hover:bg-success/20'
                  : 'bg-white/5 text-muted hover:bg-white/10 hover:text-foreground'
              }`}
            >
              {file.name}
              {file.exists && file.size !== null && (
                <span className="ml-1 opacity-60">
                  {file.size < 1024 ? `${file.size}B` : `${(file.size / 1024).toFixed(1)}K`}
                </span>
              )}
              {!file.exists && <span className="ml-1 opacity-40">+</span>}
            </button>
            {file.exists && (
              <button
                onClick={() => onDelete(file, label)}
                className="text-[10px] text-muted/40 hover:text-danger transition-colors px-0.5"
                title="삭제"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {pathStr && (
        <span className="text-[10px] font-mono text-muted truncate max-w-[200px] hidden sm:inline">
          {pathStr.replace(/^\/Users\/[^/]+\//, '~/')}
        </span>
      )}
    </div>
  );
}
