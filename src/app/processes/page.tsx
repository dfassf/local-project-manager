'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RunningProcess } from '@/types';
import { RunningTable } from '@/components/processes/RunningTable';
import { StoppedTable } from '@/components/processes/StoppedTable';

interface ProjectInfo {
  id: string;
  name: string;
  display_name: string | null;
  dev_command: string | null;
  dev_port: number | null;
  path: string;
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [configs, setConfigs] = useState<{ id: number; project_id: string; project_name: string; command: string; port: number | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [procRes, projRes] = await Promise.all([
        fetch('/api/process/status'),
        fetch('/api/projects'),
      ]);

      if (procRes.ok) setProcesses(await procRes.json());

      if (projRes.ok) {
        const projects: ProjectInfo[] = await projRes.json();
        setConfigs(
          projects
            .filter(p => p.dev_command)
            .map(p => ({
              id: 0,
              project_id: p.id,
              project_name: p.display_name || p.name,
              command: p.dev_command!,
              port: p.dev_port,
            }))
        );
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async (configId: number) => {
    setActionLoading(`start-${configId}`);
    try {
      await fetch('/api/process/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId }),
      });
      await fetchStatus();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (pid: number) => {
    setActionLoading(`stop-${pid}`);
    try {
      await fetch('/api/process/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pid }),
      });
      await fetchStatus();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const runningWithProject = processes.filter(p => p.project_id);
  const runningExternal = processes.filter(p => !p.project_id);
  const runningProjectIds = new Set(processes.map(p => p.project_id));
  const stoppedConfigs = configs.filter(c => !runningProjectIds.has(c.project_id));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">프로세스 관리</h1>
        <p className="text-sm text-muted mt-1">
          실행 중인 dev 서버를 관리합니다 · {processes.length}개 감지됨
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted">
          불러오는 중...
        </div>
      ) : (
        <div className="space-y-6">
          <RunningTable
            processes={runningWithProject}
            externalProcesses={runningExternal}
            actionLoading={actionLoading}
            onStop={handleStop}
          />
          <StoppedTable
            configs={stoppedConfigs}
            actionLoading={actionLoading}
            onStart={handleStart}
          />
        </div>
      )}
    </div>
  );
}
