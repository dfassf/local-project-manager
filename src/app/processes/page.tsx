'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RunningProcess } from '@/types';
import { ProcessGroup, type ProcessEntry } from '@/components/processes/ProcessGroup';
import { RunningTable } from '@/components/processes/RunningTable';

interface ProcessConfig {
  id: number;
  project_id: string;
  project_name: string;
  command: string;
  port: number | null;
  group_name: string;
}

export default function ProcessesPage() {
  const [processes, setProcesses] = useState<RunningProcess[]>([]);
  const [configs, setConfigs] = useState<ProcessConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [procRes, configRes] = await Promise.all([
        fetch('/api/process/status'),
        fetch('/api/process/configs'),
      ]);

      if (procRes.ok) setProcesses(await procRes.json());
      if (configRes.ok) setConfigs(await configRes.json());
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

  // 프로세스 → project_id 매핑
  const runningByProject = new Map<string, RunningProcess>();
  for (const proc of processes) {
    if (proc.project_id) runningByProject.set(proc.project_id, proc);
  }

  // configs를 group별로 분류 + 실행 상태 병합
  const grouped = new Map<string, ProcessEntry[]>();
  for (const config of configs) {
    const group = config.group_name;
    if (!grouped.has(group)) grouped.set(group, []);

    const running = runningByProject.get(config.project_id);
    grouped.get(group)!.push({
      config_id: config.id,
      project_id: config.project_id,
      project_name: config.project_name,
      command: config.command,
      port: config.port,
      running: running ? {
        pid: running.pid,
        port: running.port,
        command: running.command,
        is_managed: running.is_managed,
      } : undefined,
    });
  }

  // 각 그룹 내에서 실행중인 것을 위로
  for (const entries of grouped.values()) {
    entries.sort((a, b) => {
      if (a.running && !b.running) return -1;
      if (!a.running && b.running) return 1;
      return 0;
    });
  }

  // 외부 프로세스 (프로젝트 미매핑)
  const externalProcesses = processes.filter(p => !p.project_id);
  const runningCount = processes.filter(p => p.project_id).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">프로세스 관리</h1>
        <p className="text-sm text-muted mt-1">
          {configs.length}개 프로젝트 · {runningCount}개 실행 중
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted">
          불러오는 중...
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([group, entries]) => (
            <ProcessGroup
              key={group}
              group={group}
              entries={entries}
              actionLoading={actionLoading}
              onStart={handleStart}
              onStop={handleStop}
            />
          ))}

          {externalProcesses.length > 0 && (
            <RunningTable
              processes={[]}
              externalProcesses={externalProcesses}
              actionLoading={actionLoading}
              onStop={handleStop}
            />
          )}
        </div>
      )}
    </div>
  );
}
