"use client";

import { useState, useRef, useEffect } from "react";
import { User, LogOut, Check, Edit2, Loader2, PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon } from "lucide-react";
import { updateProfileNameAction } from "@/app/actions/profile-actions";
import { toast } from "sonner";
import Link from "next/link";

interface NavbarProps {
  user: any;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

export function Navbar({ user, isCollapsed, toggleCollapse }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.full_name || "Creator");
  const [isSaving, setIsSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    const res = await updateProfileNameAction(name);
    if (res.success) {
      toast.success("Profile updated successfully!");
      setIsEditing(false);
    } else {
      toast.error(res.error || "Failed to update profile");
    }
    setIsSaving(false);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-xl md:px-6 transition-all">
      <div className="flex items-center gap-4">
        {/* Toggle Sidebar Button (Desktop) */}
        <button 
          onClick={toggleCollapse}
          className="hidden md:flex p-2 hover:bg-background/50 rounded-xl border border-transparent hover:border-border/50 transition-colors text-muted-foreground hover:text-foreground"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 rounded-full border border-border/50 p-1 pr-3 hover:bg-background/50 transition-colors focus:outline-none"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-500">
            <User className="h-4 w-4" />
          </div>
          <span className="text-sm font-medium hidden sm:block">{name}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-border/50 bg-background/95 p-2 shadow-2xl backdrop-blur-xl">
            <div className="mb-2 p-2">
              <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
            
            <div className="mb-2 px-2 py-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Display Name</p>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background/50 px-2 py-1.5 text-sm outline-none focus:border-cyan-500 transition-colors"
                    autoFocus
                  />
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-1.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-background/30 px-2 py-1.5 rounded-lg border border-transparent hover:border-border/50 transition-colors group">
                  <span className="text-sm font-medium truncate">{name}</span>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-background/50 rounded-lg transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 pt-2">
              <Link
                href="/dashboard/settings"
                className="flex w-full items-center gap-2 rounded-xl p-2.5 text-sm text-muted-foreground hover:bg-background/50 hover:text-foreground transition-colors font-medium mb-1"
                onClick={() => setIsOpen(false)}
              >
                <SettingsIcon className="h-4 w-4" />
                Settings
              </Link>
              <Link
                href="/auth/logout"
                className="flex w-full items-center gap-2 rounded-xl p-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors font-medium"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
