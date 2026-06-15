import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, Users, Clock, Shield, Target, FileText,
  Building2, ChevronDown, ChevronRight, AlertTriangle,
  ClipboardList, CalendarDays, BookOpen, GraduationCap,
  Scale, Menu, X, LogOut, UserCircle, UserCog
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

const navSections = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ]
  },
  {
    title: 'People',
    items: [
      { label: 'Employees', icon: Users, path: '/employees' },
      { label: 'Onboarding', icon: ClipboardList, path: '/onboarding' },
      { label: 'Leave', icon: CalendarDays, path: '/leave' },
    ]
  },
  {
    title: 'Time & Rostering',
    items: [
      { label: 'Rosters', icon: CalendarDays, path: '/rosters' },
      { label: 'Timesheets', icon: Clock, path: '/timesheets' },
    ]
  },
  {
    title: 'Health & Safety',
    items: [
      { label: 'Incidents', icon: AlertTriangle, path: '/incidents' },
      { label: 'Risk Register', icon: Shield, path: '/risk-register' },
      { label: 'Hazard Register', icon: AlertTriangle, path: '/hazard-register' },
      { label: 'Meetings', icon: BookOpen, path: '/meetings' },
      { label: 'SOPs', icon: FileText, path: '/sops' },
    ]
  },
  {
    title: 'Performance',
    items: [
      { label: 'Goals & KPIs', icon: Target, path: '/goals' },
      { label: 'Reviews', icon: ClipboardList, path: '/reviews' },
      { label: 'Training', icon: GraduationCap, path: '/training' },
      { label: 'Disciplinary', icon: Scale, path: '/disciplinary' },
    ]
  },
  {
    title: 'Admin',
    items: [
      { label: 'Organisations', icon: Building2, path: '/organisations' },
      { label: 'Members', icon: UserCog, path: '/members' },
      { label: 'Documents', icon: FileText, path: '/documents' },
    ]
  }
];

export default function Sidebar({ user }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState(
    navSections.map(s => s.title)
  );

  const toggleSection = (title) => {
    setExpandedSections(prev =>
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  const content = (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-display font-bold text-sm">HR</span>
          </div>
          <div>
            <h1 className="font-display font-bold text-sm text-white">Ask Your HR</h1>
            <p className="text-[11px] text-sidebar-foreground/60">NZ Compliance Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {navSections.map(section => (
          <div key={section.title}>
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
            >
              {section.title}
              {expandedSections.includes(section.title) ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
            {expandedSections.includes(section.title) && (
              <div className="space-y-0.5 mb-2">
                {section.items.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                      )}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center">
            <UserCircle className="w-4 h-4 text-sidebar-foreground/70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user?.full_name || 'User'}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">{user?.role?.replace('_', ' ') || 'Employee'}</p>
          </div>
          <button onClick={handleLogout} className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors">
            <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/50" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-lg bg-card shadow-md border"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="w-64 h-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1 text-sidebar-foreground/50 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            {content}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 flex-shrink-0 h-screen sticky top-0">
        {content}
      </aside>
    </>
  );
}