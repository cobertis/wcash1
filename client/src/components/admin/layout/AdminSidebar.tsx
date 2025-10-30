import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Home,
  Users,
  DollarSign,
  Zap,
  Gift,
  Settings,
  TrendingUp,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Scan,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AdminSidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

// Navigation menu items
const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/admin', color: 'blue' },
  { id: 'accounts', label: 'Cuentas $100+', icon: DollarSign, href: '/admin/accounts', color: 'green', countKey: 'accounts100Plus' },
  { id: 'accounts-50-plus', label: 'Cuentas $50+', icon: TrendingUp, href: '/admin/accounts-50-plus', color: 'emerald', countKey: 'accounts50Plus' },
  { id: 'accounts-20-plus', label: 'Cuentas $20+', icon: Gift, href: '/admin/accounts-20-plus', color: 'yellow', countKey: 'accounts20Plus' },
  { id: 'accounts-10-plus', label: 'Cuentas $10+', icon: Users, href: '/admin/accounts-10-plus', color: 'orange', countKey: 'accounts10Plus' },
  { id: 'accounts-5-plus', label: 'Cuentas $5+', icon: Activity, href: '/admin/accounts-5-plus', color: 'purple', countKey: 'accounts5Plus' },
  { id: 'new-accounts', label: 'Nuevas Cuentas', icon: Zap, href: '/admin/new-accounts', color: 'pink', countKey: 'newAccounts' },
  { id: 'scanner', label: 'Scanner', icon: Scan, href: '/admin/scanner', color: 'indigo' },
  { id: 'search', label: 'Buscar', icon: Search, href: '/admin/search', color: 'slate' },
  { id: 'settings', label: 'Configuración', icon: Settings, href: '/admin/settings', color: 'gray' },
];

const colorClasses = {
  blue: 'from-blue-500 to-blue-600',
  green: 'from-green-500 to-green-600',
  emerald: 'from-emerald-500 to-emerald-600',
  yellow: 'from-yellow-500 to-yellow-600',
  orange: 'from-orange-500 to-orange-600',
  purple: 'from-purple-500 to-purple-600',
  pink: 'from-pink-500 to-pink-600',
  indigo: 'from-indigo-500 to-indigo-600',
  slate: 'from-slate-500 to-slate-600',
  gray: 'from-gray-500 to-gray-600',
};

export default function AdminSidebar({ open, collapsed, onClose, onToggleCollapse }: AdminSidebarProps) {
  const [location, navigate] = useLocation();
  const [accountSegmentCounts, setAccountSegmentCounts] = useState({
    accounts100Plus: 0,
    accounts50Plus: 0,
    accounts20Plus: 0,
    accounts10Plus: 0,
    accounts5Plus: 0,
    newAccounts: 0,
    total: 0
  });

  // Fetch sidebar counters
  const { data: countersData } = useQuery({
    queryKey: ['/api/member-history/sidebar-counters'],
    queryFn: async () => {
      const response = await fetch('/api/member-history/sidebar-counters');
      if (!response.ok) throw new Error('Failed to fetch counters');
      return response.json();
    },
  });

  useEffect(() => {
    if (countersData) {
      setAccountSegmentCounts(countersData);
    }
  }, [countersData]);

  // Get current active tab from location
  const getCurrentTab = () => {
    const path = location.split('/')[2] || 'dashboard';
    return path;
  };

  const currentTab = getCurrentTab();

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Collapse toggle - Desktop only */}
      <div className="hidden lg:flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        {!collapsed && (
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Navegación
          </h2>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8"
          data-testid="button-toggle-sidebar-collapse"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation Items */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            const count = item.countKey ? accountSegmentCounts[item.countKey as keyof typeof accountSegmentCounts] : null;
            
            const NavButton = (
              <Button
                key={item.id}
                variant="ghost"
                onClick={() => {
                  navigate(item.href);
                  onClose();
                }}
                className={cn(
                  "w-full",
                  collapsed ? "justify-center px-2" : "justify-start px-4",
                  isActive
                    ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                    : "text-slate-700 dark:text-slate-300",
                  "hover:bg-slate-200 dark:hover:bg-slate-800",
                  "hover:text-slate-900 dark:hover:text-white"
                )}
                data-testid={`nav-button-${item.id}`}
              >
                <item.icon className={cn("h-5 w-5 flex-shrink-0", !collapsed && "mr-3")} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left text-sm font-medium">
                      {item.label}
                    </span>
                    {count !== null && count > 0 && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "ml-auto",
                          isActive 
                            ? "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {count}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            );

            // Wrap with tooltip only when collapsed (desktop)
            if (collapsed) {
              return (
                <TooltipProvider key={item.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>{NavButton}</TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                      {count !== null && count > 0 && <p className="text-xs">({count})</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            }

            return NavButton;
          })}
        </nav>
      </ScrollArea>

      {/* Export Button */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        <Button
          onClick={async () => {
            try {
              const response = await fetch('/api/export/members');
              if (!response.ok) throw new Error('Export failed');
              
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `walgreens-members-${new Date().toISOString().split('T')[0]}.xlsx`;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            } catch (error) {
              console.error('Export error:', error);
            }
          }}
          className={cn(
            "w-full justify-start gap-3 h-11",
            "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-500 hover:to-green-600",
            "text-white shadow-sm",
            collapsed && "justify-center px-0"
          )}
          data-testid="button-export-members"
        >
          <Download className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Exportar Excel</span>}
        </Button>
      </div>

    </div>
  );

  return (
    <>
      {/* Mobile Sheet */}
      <Sheet open={open && window.innerWidth < 1024} onOpenChange={onClose}>
        <SheetContent side="left" className="w-80 p-0">
          <SidebarContent />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:block border-r border-slate-200 dark:border-slate-800",
          "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl",
          "transition-all duration-300 ease-in-out",
          collapsed ? "w-[72px]" : "w-[280px]"
        )}
        data-testid="sidebar-desktop"
      >
        <SidebarContent />
      </aside>
    </>
  );
}
