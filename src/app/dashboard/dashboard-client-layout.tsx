"use client";

import { useSyncExternalStore } from "react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";

function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener('creatoros-sidebar', listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener('creatoros-sidebar', listener); };
}
function collapsedSnapshot() { try { return localStorage.getItem('sidebar_collapsed') === 'true'; } catch { return false; } }

export function DashboardClientLayout({ 
  children, 
  user 
}: { 
  children: React.ReactNode;
  user: { full_name?: string | null; email?: string | null } | null;
}) {
  const isCollapsed = useSyncExternalStore(subscribe, collapsedSnapshot, () => false);

  const toggleCollapse = () => {
    try { localStorage.setItem('sidebar_collapsed', String(!isCollapsed)); window.dispatchEvent(new Event('creatoros-sidebar')); } catch { /* Storage may be disabled by the browser. */ }
  };

  return (
    <div className="flex min-h-screen bg-background bg-depth">
      <Sidebar isCollapsed={isCollapsed} />
      <div 
        className={`flex flex-col flex-1 min-h-screen transition-all duration-300 ease-in-out
          ${isCollapsed ? 'md:ml-16' : 'md:ml-64'} 
          pt-16 md:pt-0`}
      >
        <Navbar user={user} isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
