import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

// App pages
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Employees from '@/pages/Employees';
import Onboarding from '@/pages/Onboarding';
import Leave from '@/pages/Leave';
import Rosters from '@/pages/Rosters';
import Timesheets from '@/pages/Timesheets';
import Incidents from '@/pages/Incidents';
import RiskRegister from '@/pages/RiskRegister';
import HazardRegister from '@/pages/HazardRegister';
import Meetings from '@/pages/Meetings';
import SOPs from '@/pages/SOPs';
import Goals from '@/pages/Goals';
import Reviews from '@/pages/Reviews';
import Training from '@/pages/Training';
import Disciplinary from '@/pages/Disciplinary';
import Organisations from '@/pages/Organisations';
import Members from '@/pages/Members';
import Documents from '@/pages/Documents';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-display font-bold text-sm">HR</span>
          </div>
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/rosters" element={<Rosters />} />
          <Route path="/timesheets" element={<Timesheets />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/risk-register" element={<RiskRegister />} />
          <Route path="/hazard-register" element={<HazardRegister />} />
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/sops" element={<SOPs />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/reviews" element={<Reviews />} />
          <Route path="/training" element={<Training />} />
          <Route path="/disciplinary" element={<Disciplinary />} />
          <Route path="/organisations" element={<Organisations />} />
          <Route path="/members" element={<Members />} />
          <Route path="/documents" element={<Documents />} />
        </Route>
      </Route>
      
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App