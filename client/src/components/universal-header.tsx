import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Menu, Pill } from "lucide-react";

export default function UniversalHeader() {
  const handleLogout = () => {
    console.log('Logout button clicked');
    sessionStorage.removeItem('adminAuth');
    window.location.href = '/';
  };

  const handleMenuToggle = () => {
    console.log('Menu button clicked - toggling sidebar');
    // Emit custom event to toggle sidebar without navigation
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16">
          {/* Mobile menu button - Left side on mobile */}
          <div className="flex items-center sm:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMenuToggle}
              className="p-2 touch-target-44 mr-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Logo - Centered on mobile, left aligned on desktop */}
          <div className="flex items-center flex-1 justify-center sm:justify-start sm:flex-initial">
            <a href="/admin" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 bg-red-600 rounded-sm flex items-center justify-center">
                <span className="text-white font-bold text-lg">W</span>
              </div>
              <div className="text-blue-600 font-bold text-xl">
                Walgreens
              </div>
            </a>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center space-x-2 relative z-10 ml-auto">
            {/* Status indicator - Hidden on mobile */}
            <div className="hidden md:flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                API Online
              </Badge>
            </div>

            {/* Desktop logout */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hidden sm:flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>

            {/* Mobile logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="sm:hidden p-2 touch-target-44"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}