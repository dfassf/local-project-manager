'use client';

import { useRef, useState } from 'react';
import { ProjectCard } from '@/components/project-card';
import type { ProjectWithStatus } from '@/types';

type Props = {
  group: string;
  projects: ProjectWithStatus[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onGroupRenamed: () => void;
};

export function ProjectGroup({ group, projects, collapsed, onToggleCollapse, onGroupRenamed }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    setEditValue(group);
    setTimeout(() => editRef.current?.focus(), 0);
  };

  const saveGroupName = async () => {
    if (!editValue.trim() || editValue === group) {
      setEditing(false);
      return;
    }
    try {
      const res = await fetch('/api/groups', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName: group, newName: editValue.trim() }),
      });
      if (res.ok) onGroupRenamed();
    } catch {
      // ignore
    }
    setEditing(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onToggleCollapse}
          className="text-muted hover:text-foreground transition-colors text-xs"
          title={collapsed ? '펼치기' : '접기'}
        >
          {collapsed ? '▶' : '▼'}
        </button>
        {editing ? (
          <input
            ref={editRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={saveGroupName}
            onKeyDown={e => {
              if (e.key === 'Enter') saveGroupName();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="text-sm font-semibold bg-card border border-accent rounded px-2 py-0.5 outline-none text-foreground w-32"
          />
        ) : (
          <div className="group/name flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">
              {group} ({projects.length})
            </h2>
            <button
              onClick={startEdit}
              className="opacity-0 group-hover/name:opacity-100 transition-opacity text-muted hover:text-foreground"
              title="이름 변경"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
              </svg>
            </button>
          </div>
        )}
        <span className="text-[10px] text-muted/60">· 최근 커밋순</span>
      </div>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {projects.map(project => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
