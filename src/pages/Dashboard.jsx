import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sdList } from '@/lib/secureDataClient';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, Clock, AlertTriangle, ClipboardList, Shield, Target,
  CalendarDays, GraduationCap, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

function QuickLink({ icon: Icon, label, to, count }) {
  return (
    <Link to={to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      {count !== undefined && (
        <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
      )}
      <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => sdList('Incident'),
  });

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => sdList('Timesheet'),
  });

  const { data: onboardingTasks = [] } = useQuery({
    queryKey: ['onboardingTasks'],
    queryFn: () => sdList('OnboardingTask'),
  });

  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const onboardingCount = employees.filter(e => e.status === 'onboarding').length;
  const openIncidents = incidents.filter(i => i.status !== 'closed').length;
  const pendingTimesheets = timesheets.filter(t => t.status === 'submitted').length;
  const pendingOnboarding = onboardingTasks.filter(t => t.status === 'pending').length;

  const expiringVisas = employees.filter(e => {
    if (!e.visa_expiry) return false;
    const expiry = new Date(e.visa_expiry);
    const threeMonths = new Date();
    threeMonths.setMonth(threeMonths.getMonth() + 3);
    return expiry <= threeMonths && expiry > new Date();
  });

  const expiringCerts = employees.flatMap(e => 
    (e.certifications || []).filter(c => {
      if (!c.expiry_date) return false;
      const expiry = new Date(c.expiry_date);
      const threeMonths = new Date();
      threeMonths.setMonth(threeMonths.getMonth() + 3);
      return expiry <= threeMonths && expiry > new Date();
    }).map(c => ({ ...c, employeeName: `${e.first_name} ${e.last_name}` }))
  );

  const recentIncidents = incidents.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'there'}`}
        subtitle={`${format(new Date(), 'EEEE, d MMMM yyyy')} — Here's your HR overview`}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Active Employees" value={activeEmployees} icon={Users} />
        <StatCard title="Onboarding" value={onboardingCount} icon={ClipboardList} />
        <StatCard title="Open Incidents" value={openIncidents} icon={AlertTriangle} />
        <StatCard title="Pending Timesheets" value={pendingTimesheets} icon={Clock} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Compliance Alerts */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Compliance Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingOnboarding > 0 && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <ClipboardList className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">{pendingOnboarding} pending onboarding tasks</p>
                <Link to="/onboarding" className="ml-auto text-xs font-medium text-amber-700 hover:underline">View</Link>
              </div>
            )}
            {expiringVisas.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <Shield className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{expiringVisas.length} visa(s) expiring within 3 months</p>
                <Link to="/employees" className="ml-auto text-xs font-medium text-red-700 hover:underline">View</Link>
              </div>
            )}
            {expiringCerts.length > 0 && (
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                <GraduationCap className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <p className="text-sm text-orange-800">{expiringCerts.length} certification(s) expiring soon</p>
                <Link to="/training" className="ml-auto text-xs font-medium text-orange-700 hover:underline">View</Link>
              </div>
            )}
            {pendingTimesheets > 0 && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-800">{pendingTimesheets} timesheet(s) awaiting approval</p>
                <Link to="/timesheets" className="ml-auto text-xs font-medium text-blue-700 hover:underline">View</Link>
              </div>
            )}
            {openIncidents > 0 && (
              <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{openIncidents} open H&S incident(s)</p>
                <Link to="/incidents" className="ml-auto text-xs font-medium text-red-700 hover:underline">View</Link>
              </div>
            )}
            {pendingOnboarding === 0 && expiringVisas.length === 0 && expiringCerts.length === 0 && pendingTimesheets === 0 && openIncidents === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">All clear — no compliance alerts</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <QuickLink icon={Users} label="Add Employee" to="/employees" />
            <QuickLink icon={AlertTriangle} label="Report Incident" to="/incidents" />
            <QuickLink icon={Clock} label="Timesheets" to="/timesheets" count={pendingTimesheets} />
            <QuickLink icon={CalendarDays} label="Manage Rosters" to="/rosters" />
            <QuickLink icon={Target} label="Performance Reviews" to="/reviews" />
            <QuickLink icon={Shield} label="Risk Register" to="/risk-register" />
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      {recentIncidents.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">Recent Incidents</CardTitle>
              <Link to="/incidents" className="text-xs font-medium text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentIncidents.map(incident => (
                <div key={incident.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <StatusBadge status={incident.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{incident.description?.substring(0, 60)}{incident.description?.length > 60 ? '...' : ''}</p>
                    <p className="text-xs text-muted-foreground capitalize">{incident.incident_type?.replace('_', ' ')} — {incident.location}</p>
                  </div>
                  <StatusBadge status={incident.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}