'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: '대시보드', icon: '◆' },
  { href: '/processes', label: '프로세스', icon: '▶' },
  { href: '/secrets', label: '키 관리', icon: '🔑' },
  { href: '/settings', label: '설정', icon: '⚙' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-sidebar border-r border-border flex flex-col shrink-0">
      <div className="p-4 border-b border-border">
        <h1 className="text-lg font-bold tracking-tight">관제 센터</h1>
        <p className="text-xs text-muted mt-0.5">Project Command Center</p>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-accent/15 text-accent-hover font-medium'
                  : 'text-muted hover:text-foreground hover:bg-card'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <p className="text-[10px] text-muted text-center">v0.1.0</p>
      </div>
    </aside>
  );
}
