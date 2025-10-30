import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import UniversalHeader from "@/components/universal-header";
import ControlPanel from "@/components/control-panel";
import Dashboard from "@/pages/dashboard";
import LoginPage from "@/components/login-page";
import ProtectedRoute from "@/components/protected-route";
import NotFound from "@/pages/not-found";
import GlobalProgressBar from "@/components/global-progress-bar";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/" component={() => {
        // Redirect to admin dashboard
        window.location.href = '/admin';
        return null;
      }} />
      <Route path="/admin" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/admin/accounts/:phoneNumber" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/admin/:section" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/admin/member/:phone" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/admin/member/:phone/:section" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/profile/:id" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/profile/:id/:section" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/member/:phone/overview" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route path="/member/:phone/:section" component={() => (
        <ProtectedRoute>
          <ControlPanel />
        </ProtectedRoute>
      )} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50">
          <GlobalProgressBar />
          <Router />
        </div>

      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
