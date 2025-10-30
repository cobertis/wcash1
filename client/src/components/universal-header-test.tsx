import { Button } from "@/components/ui/button";
import { LogOut, Menu } from "lucide-react";

export default function UniversalHeaderTest() {
  const handleLogout = () => {
    console.log('Logout button clicked');
    sessionStorage.removeItem('adminAuth');
    window.location.href = '/';
  };

  const handleMenuToggle = () => {
    console.log('Menu button clicked');
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <div className="text-blue-600 font-bold text-xl">
              Walgreens
            </div>
          </div>

          {/* Centered Title - Mobile Only */}
          <div className="absolute inset-0 flex items-center justify-center sm:hidden">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              Panel de Control
            </h1>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center space-x-2">
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
              className="sm:hidden p-2"
            >
              <LogOut className="h-5 w-5" />
            </Button>

            {/* Mobile menu */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMenuToggle}
              className="sm:hidden p-2"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}