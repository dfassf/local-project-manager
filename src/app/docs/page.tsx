'use client';

import { useDocs, LEVEL_META } from '@/hooks/useDocs';
import { DocEditor } from '@/components/docs/DocEditor';
import type { DocFile, DocLevel } from '@/hooks/useDocs';

export default function DocsPage() {
  const {
    loading, editor, saving, toast,
    deleteConfirm, setDeleteConfirm,
    handleOpen, handleSave, handleDelete,
    updateContent, revertContent, closeEditor,
    hasChanges,
    globalLevel, workspaceLevels,
    projectsByWorkspace, totalFiles,
  } = useDocs();

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">AI 설정</h1>
        <p className="text-sm text-muted">로딩 중...</p>
      </div>
    );
  }

  if (editor) {
    return (
      <DocEditor
        editor={editor}
        hasChanges={hasChanges}
        saving={saving}
        onContentChange={updateContent}
        onSave={handleSave}
        onRevert={revertContent}
        onClose={closeEditor}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">AI 설정</h1>
        <p className="text-sm text-muted mt-1">
          CLAUDE.md · AGENTS.md — {totalFiles}개 파일 관리 중
        </p>
      </div>

      <div className="space-y-4">
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

        {workspaceLevels.map(ws => {
          const projects = projectsByWorkspace.get(ws.label) || [];
          return (
            <section key={ws.dirPath} className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{LEVEL_META.workspace.icon}</span>
                  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    {ws.label}
                  </h2>
                  <span className="text-[10px] text-muted">{LEVEL_META.workspace.desc}</span>
                </div>
              </div>

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
