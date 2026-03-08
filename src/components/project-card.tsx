'use client';

import Link from 'next/link';
import type { ProjectWithStatus } from '@/types';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  nextjs: { label: 'Next.js', color: 'bg-white/10 text-white' },
  nestjs: { label: 'NestJS', color: 'bg-red-500/15 text-red-400' },
  'vite-react': { label: 'React', color: 'bg-cyan-500/15 text-cyan-400' },
  react: { label: 'React', color: 'bg-cyan-500/15 text-cyan-400' },
  vue: { label: 'Vue', color: 'bg-emerald-500/15 text-emerald-400' },
  hono: { label: 'Hono', color: 'bg-orange-500/15 text-orange-400' },
  python: { label: 'Python', color: 'bg-yellow-500/15 text-yellow-400' },
  monorepo: { label: 'Monorepo', color: 'bg-purple-500/15 text-purple-400' },
  expo: { label: 'Expo', color: 'bg-blue-500/15 text-blue-400' },
  node: { label: 'Node.js', color: 'bg-green-500/15 text-green-400' },
  fullstack: { label: 'Fullstack', color: 'bg-indigo-500/15 text-indigo-400' },
  unknown: { label: '기타', color: 'bg-gray-500/15 text-gray-400' },
};

function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월 전`;

  return `${Math.floor(months / 12)}년 전`;
}

export function ProjectCard({ project }: { project: ProjectWithStatus }) {
  const typeInfo = TYPE_LABELS[project.project_type || 'unknown'] || TYPE_LABELS.unknown;
  const isRunning = project.running_pid !== null;

  return (
    <Link
      href={`/project/${project.id}`}
      className="block bg-card border border-border rounded-lg p-4 hover:bg-card-hover hover:border-accent/30 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? 'bg-success animate-pulse' : 'bg-muted/40'}`}
          />
          <h3 className="font-semibold text-sm truncate">{project.display_name || project.name}</h3>
        </div>
        {isRunning && (
          <span className="text-[10px] font-mono text-success bg-success/10 px-1.5 py-0.5 rounded shrink-0">
            :{project.running_port}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeInfo.color}`}>
          {typeInfo.label}
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted">
          {project.group_name}
        </span>
        {project.is_monorepo && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
            mono
          </span>
        )}
      </div>

      {project.last_commit_message && (
        <p className="text-xs text-muted line-clamp-2 mb-2">
          {project.last_commit_message}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted">
        <span>
          {project.last_commit_date
            ? getRelativeTime(project.last_commit_date)
            : '커밋 없음'}
        </span>
        {project.note_count > 0 && (
          <span className="text-accent">메모 {project.note_count}건</span>
        )}
      </div>
    </Link>
  );
}
