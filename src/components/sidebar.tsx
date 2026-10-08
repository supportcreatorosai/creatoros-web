"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Mic,
  User,
  Image as ImageIcon,
  Type,
  FolderOpen,
  Calendar,
  Clock,
  BarChart,
  Settings,
  Menu,
  MonitorPlay,
  LogOut
} from "lucide-react";
import { useState } from "react";

const sidebarNavItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-5 h-5 flex-shrink-0" />,
  },
  { title: "CREATE", heading: true },
  {
    title: "Lesson Generator",
    href: "/dashboard/lesson-generator",
    icon: <BookOpen className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: "Voice Studio",
    href: "/dashboard/voice-studio",
    icon: <Mic className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: "Avatar Studio",
    href: "/dashboard/avatar-studio",
    icon: <User className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: "Thumbnail Generator",
    href: "/dashboard/thumbnail-generator",
    icon: <ImageIcon className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: "Captions & Hashtags",
    href: "/dashboard/captions",
    icon: <Type className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: "YouTube Generator",
    href: "/dashboard/youtube-generator",
    icon: <MonitorPlay className="w-5 h-5 flex-shrink-0 text-red-500" />,
  },
  { title: "MANAGE", heading: true },
  {
    title: "Media Library",
    href: "/dashboard/media",
    icon: <FolderOpen className="w-5 h-5 flex-shrink-0" />,
  },
  {
    title: "Calendar",
    href: "/dashboard/calendar",
    icon: <Calendar className="w-5 h-5 flex-shrink-0" />,
  },

  { title: "INSIGHTS", heading: true },
  {
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: <BarChart className="w-5 h-5 flex-shrink-0" />,
  },

];

export function Sidebar({ isCollapsed = false }: { isCollapsed?: boolean }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Mobile Hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-xl border-b border-border/50 z-50 flex items-center px-4 justify-between">
        <Link href="/" className="font-semibold text-primary text-xl">CreatorOS AI</Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-background/50 rounded-xl border border-border/50">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <div className={`md:hidden fixed inset-0 bg-background/95 backdrop-blur-2xl z-40 transition-transform duration-300 ease-in-out pt-20 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex-1 overflow-auto h-full pb-20">
          <nav className="grid items-start px-4 text-sm font-medium gap-2">
            {sidebarNavItems.map((item, index) => {
              if (item.heading) {
                return (
                  <div key={index} className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider mt-4">
                    {item.title}
                  </div>
                );
              }
              const isActive = pathname === item.href;
              return (
                <Link
                  key={index}
                  href={item.href!}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-muted-foreground hover:bg-background/50 border border-transparent"
                  }`}
                >
                  {item.icon}
                  <span className="text-base font-semibold">{item.title}</span>
                </Link>
              );
            })}
          </nav>
          <div className="p-4 mt-8 border-t border-border/50">
            <a
              href="/auth/logout"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-3 transition-all text-red-500 hover:bg-red-500/10 border border-transparent"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className="text-base font-semibold">Sign Out</span>
            </a>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col z-40 fixed top-0 left-0 h-screen transition-all duration-300 ease-in-out border-r border-border/50 group overflow-hidden bg-background/60 backdrop-blur-2xl hover:shadow-2xl ${isCollapsed ? 'w-16 hover:w-64' : 'w-64'}`}>
        <div className="flex h-16 items-center flex-shrink-0 px-4 border-b border-border/50 w-64">
          <Link href="/" className="flex items-center gap-3 font-semibold text-primary whitespace-nowrap">
            <Image src="/icon.png" alt="CreatorOS AI Logo" width={32} height={32} className="rounded-xl flex-shrink-0" />
            <span className={`text-xl transition-opacity duration-300 ${isCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>CreatorOS AI</span>
          </Link>
        </div>
        
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 w-64 scrollbar-hide">
          <nav className="grid items-start px-2 text-sm font-medium gap-1">
            {sidebarNavItems.map((item, index) => {
              if (item.heading) {
                return (
                  <div key={index} className={`px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-4 transition-opacity duration-300 whitespace-nowrap ${isCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                    {item.title}
                  </div>
                );
              }
              const isActive = pathname === item.href;
              return (
                <Link
                  key={index}
                  href={item.href!}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all w-full relative group/item overflow-hidden ${
                    isActive
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                      : "text-muted-foreground hover:bg-background/80 hover:text-foreground border border-transparent"
                  }`}
                  title={item.title}
                >
                  <div className="flex-shrink-0 flex items-center justify-center w-5">{item.icon}</div>
                  <span className={`whitespace-nowrap font-semibold transition-opacity duration-300 ${isCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex-shrink-0 p-2 w-64 border-t border-border/50">
          <a
            href="/auth/logout"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all w-full relative group/item overflow-hidden text-red-500 hover:bg-red-500/10 border border-transparent"
            title="Sign Out"
          >
            <div className="flex-shrink-0 flex items-center justify-center w-5">
              <LogOut className="w-5 h-5 flex-shrink-0" />
            </div>
            <span className={`whitespace-nowrap font-semibold transition-opacity duration-300 ${isCollapsed ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
              Sign Out
            </span>
          </a>
        </div>
      </aside>
    </>
  );
}
