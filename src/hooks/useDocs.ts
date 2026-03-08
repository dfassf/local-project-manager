'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

export interface DocFile {
  name: string;
  exists: boolean;
  size: number | null;
  path: string;
}

export interface DocLevel {
  level: 'global' | 'workspace' | 'project';
  label: string;
  dirPath: string;
  id?: string;
  group_name?: string;
  files: DocFile[];
}

export interface EditorState {
  filePath: string;
  fileName: string;
  levelLabel: string;
  content: string;
  original: string;
  isNew: boolean;
}

export type DeleteConfirmState = { file: DocFile; label: string } | null;

export const LEVEL_META = {
  global: { icon: '🌐', desc: '모든 Claude Code 세션에 적용' },
  workspace: { icon: '📁', desc: '하위 모든 프로젝트에 적용' },
  project: { icon: '📦', desc: '해당 프로젝트에만 적용' },
} as const;

export function useDocs() {
  const [levels, setLevels] = useState<DocLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/docs');
      if (res.ok) setLevels(await res.json());
    } catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  };

  const handleOpen = async (file: DocFile, label: string) => {
    const res = await fetch('/api/docs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: file.path }),
    });
    if (res.ok) {
      const { content, isNew } = await res.json();
      setEditor({ filePath: file.path, fileName: file.name, levelLabel: label, content, original: content, isNew });
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

  const updateContent = (content: string) => {
    if (editor) setEditor({ ...editor, content });
  };

  const revertContent = () => {
    if (editor) setEditor({ ...editor, content: editor.original });
  };

  const closeEditor = () => setEditor(null);

  const hasChanges = editor ? editor.content !== editor.original : false;

  const { globalLevel, workspaceLevels, projectsByWorkspace, totalFiles } = useMemo(() => {
    const global = levels.find(l => l.level === 'global');
    const workspaces = levels.filter(l => l.level === 'workspace');
    const projects = levels.filter(l => l.level === 'project');

    const byWorkspace = new Map<string, DocLevel[]>();
    for (const ws of workspaces) {
      byWorkspace.set(ws.label, []);
    }
    for (const proj of projects) {
      const ws = workspaces.find(w => proj.dirPath.startsWith(w.dirPath));
      const key = ws?.label || '기타';
      if (!byWorkspace.has(key)) byWorkspace.set(key, []);
      byWorkspace.get(key)!.push(proj);
    }

    const total = levels.reduce((sum, l) => sum + l.files.filter(f => f.exists).length, 0);

    return { globalLevel: global, workspaceLevels: workspaces, projectsByWorkspace: byWorkspace, totalFiles: total };
  }, [levels]);

  return {
    loading, editor, saving, toast,
    deleteConfirm, setDeleteConfirm,
    handleOpen, handleSave, handleDelete,
    updateContent, revertContent, closeEditor,
    hasChanges,
    globalLevel, workspaceLevels,
    projectsByWorkspace, totalFiles,
  };
}
