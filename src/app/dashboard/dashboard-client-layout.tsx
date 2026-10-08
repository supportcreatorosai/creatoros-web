"use client";

import { useState, useEffect } from "react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";

export function DashboardClientLayout({ 
  children, 
  user 
}: { 
  children: React.ReactNode;
  user: any;
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar_collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem("sidebar_collapsed", String(newVal));
      return newVal;
    });
  };

  if (!mounted) {
    return <div className="min-h-screen bg-background bg-depth"></div>; // Prevent hydration mismatch flash
  }

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
