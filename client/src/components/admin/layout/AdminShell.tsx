import { useState, useEffect } from "react";
import AdminHeader from "./AdminHeader";
import AdminSidebar from "./AdminSidebar";
import { cn } from "@/lib/utils";

interface AdminShellProps {
  children: React.ReactNode;
}

export default function AdminShell({ children }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('admin-sidebar-collapsed');
    if (savedState !== null) {
      setSidebarCollapsed(savedState === 'true');
    }
  }, []);

  // Save sidebar state to localStorage
  const toggleSidebarCollapsed = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('admin-sidebar-collapsed', String(newState));
  };

  // Listen for toggle-sidebar event from header
  useEffect(() => {
    const handleToggleSidebar = () => {
      setSidebarOpen(prev => !prev);
    };

    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    
    return () => {
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 dark:from-slate-900 dark:via-blue-950 dark:to-slate-900">
      {/* Full-screen grid layout */}
      <div className="h-screen grid grid-rows-[auto_1fr] overflow-hidden">
        {/* Fixed Header */}
        <AdminHeader 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main content area with sidebar */}
        <div className="grid lg:grid-cols-[auto_1fr] overflow-hidden">
          {/* Responsive Sidebar */}
          <AdminSidebar
            open={sidebarOpen}
            collapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            onToggleCollapse={toggleSidebarCollapsed}
          />

          {/* Main Content - Full height with scroll */}
          <main className={cn(
            "overflow-y-auto overflow-x-hidden",
            "bg-gradient-to-b from-transparent to-white/50 dark:to-slate-900/50",
            "transition-all duration-300"
          )}>
            <div className="w-full h-full p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
