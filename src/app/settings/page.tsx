'use client';

import { ScanDirManager } from '@/components/settings/ScanDirManager';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">설정</h1>

      <div className="space-y-6">
        <ScanDirManager />

        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">AI 분석</h2>
          <p className="text-xs text-muted">
            로컬 Claude CLI를 사용하여 프로젝트를 분석합니다.
          </p>
          <p className="text-xs text-muted mt-1">
            <code className="text-accent">claude</code> 명령어가 설치되어 있어야 합니다.
          </p>
        </section>

        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Claude Code 이력</h2>
          <div className="flex items-center gap-2 bg-white/5 p-2 rounded text-sm">
            <span className="text-accent">●</span>
            <code className="text-muted font-mono text-xs">~/.claude/projects/</code>
          </div>
          <p className="text-xs text-muted mt-3">
            Claude Code 대화 이력은 프로젝트 스캔 시 자동으로 파싱됩니다
          </p>
        </section>

        <section className="bg-card border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">정보</h2>
          <div className="text-xs text-muted space-y-1">
            <p>프로젝트 관제 센터 v0.1.0</p>
            <p>Next.js + SQLite + Tailwind CSS</p>
            <p>DB 위치: <code className="text-accent">data/command-center.db</code></p>
          </div>
        </section>
      </div>
    </div>
  );
}
