'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProjectWithStatus } from '@/types';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { ProjectGroup } from '@/components/dashboard/ProjectGroup';

const STORAGE_KEY = 'pcc-dashboard';

function loadStorage() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveStorage(data: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadStorage(), ...data }));
}

export default function Dashboard() {
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = loadStorage();
    if (saved.search) setSearch(saved.search);
    if (saved.groupFilter) setGroupFilter(saved.groupFilter);
    if (saved.statusFilter) setStatusFilter(saved.statusFilter);
    if (saved.collapsed) setCollapsed(saved.collapsed);
  }, []);

  useEffect(() => {
    saveStorage({ search, groupFilter, statusFilter, collapsed });
  }, [search, groupFilter, statusFilter, collapsed]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('프로젝트 목록 조회 실패');
      setProjects(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 30000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/projects/scan');
      if (!res.ok) throw new Error('스캔 실패');
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : '스캔 오류');
    } finally {
      setScanning(false);
    }
  };

  const toggleCollapse = (group: string) => {
    setCollapsed(prev => {
      const next = { ...prev, [group]: !prev[group] };
      saveStorage({ collapsed: next });
      return next;
    });
  };

  const filtered = projects.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      const match = p.name.toLowerCase().includes(q)
        || (p.display_name?.toLowerCase().includes(q))
        || (p.project_type?.toLowerCase().includes(q))
        || (p.last_commit_message?.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (groupFilter !== 'all' && p.group_name !== groupFilter) return false;
    if (statusFilter === 'running' && !p.running_pid) return false;
    if (statusFilter === 'stopped' && p.running_pid) return false;
    return true;
  });

  const groups = [...new Set(projects.map(p => p.group_name))];
  const runningCount = projects.filter(p => p.running_pid).length;

  const grouped = filtered.reduce<Record<string, ProjectWithStatus[]>>((acc, p) => {
    const group = p.group_name;
    if (!acc[group]) acc[group] = [];
    acc[group].push(p);
    return acc;
  }, {});

  for (const group of Object.keys(grouped)) {
    grouped[group].sort((a, b) => {
      if (!a.last_commit_date && !b.last_commit_date) return 0;
      if (!a.last_commit_date) return 1;
      if (!b.last_commit_date) return -1;
      return new Date(b.last_commit_date).getTime() - new Date(a.last_commit_date).getTime();
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">프로젝트 관제 센터</h1>
          <p className="text-sm text-muted mt-1">
            {projects.length}개 프로젝트 · {runningCount}개 실행 중
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
        >
          {scanning ? '스캔 중...' : '프로젝트 스캔'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-md text-sm text-danger">
          {error}
        </div>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        groups={groups}
      />

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted">
          <p>프로젝트 불러오는 중...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted">
          <p className="text-lg mb-2">프로젝트가 없습니다</p>
          <p className="text-sm">상단의 &quot;프로젝트 스캔&quot; 버튼을 눌러주세요</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([group, groupProjects]) => (
            <ProjectGroup
              key={group}
              group={group}
              projects={groupProjects}
              collapsed={!!collapsed[group]}
              onToggleCollapse={() => toggleCollapse(group)}
              onGroupRenamed={fetchProjects}
            />
          ))}
        </div>
      )}
    </div>
  );
}
