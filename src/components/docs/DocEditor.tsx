'use client';

import type { EditorState } from '@/hooks/useDocs';

interface DocEditorProps {
  editor: EditorState;
  hasChanges: boolean;
  saving: boolean;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onRevert: () => void;
  onClose: () => void;
}

export function DocEditor({
  editor, hasChanges, saving,
  onContentChange, onSave, onRevert, onClose,
}: DocEditorProps) {
  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-48px)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (hasChanges && !confirm('저장하지 않은 변경사항이 있습니다. 나가시겠습니까?')) return;
              onClose();
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
            onClick={onRevert}
            disabled={!hasChanges}
            className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 text-muted rounded transition-colors disabled:opacity-30"
          >
            되돌리기
          </button>
          <button
            onClick={onSave}
            disabled={!hasChanges || saving}
            className="text-xs px-3 py-1.5 bg-accent/20 hover:bg-accent/30 text-accent rounded transition-colors disabled:opacity-30"
          >
            {saving ? '저장 중...' : editor.isNew ? '생성' : '저장'}
          </button>
        </div>
      </div>

      <textarea
        value={editor.content}
        onChange={e => onContentChange(e.target.value)}
        placeholder={`# ${editor.fileName}\n\n프로젝트 지침을 작성하세요.`}
        spellCheck={false}
        className="flex-1 w-full bg-card border border-border rounded-lg p-4 text-sm font-mono text-foreground resize-none focus:outline-none focus:border-accent/50 placeholder:text-muted/40"
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            if (hasChanges) onSave();
          }
        }}
      />
    </div>
  );
}
