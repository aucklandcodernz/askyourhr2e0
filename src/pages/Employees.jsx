import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sdList, sdCreate } from '@/lib/secureDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Users, Mail, Building2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import EmployeeForm from '@/components/employees/EmployeeForm';
import EmployeeDetail from '@/components/employees/EmployeeDetail';

export default function Employees() {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('Employee', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setShowAdd(false);
    },
  });

  const filtered = employees.filter(e => {
    const matchesSearch = !search ||
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.position?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getOrgName = (orgId) => orgs.find(o => o.id === orgId)?.name || '';

  if (selectedEmployee) {
    return <EmployeeDetail employee={selectedEmployee} onBack={() => setSelectedEmployee(null)} organizations={orgs} />;
  }

  return (
    <div>
      <PageHeader
        title="Employees"
        subtitle={`${employees.length} total employees`}
        actions={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-2" />Add Employee</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or position..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
            <SelectItem value="resigned">Resigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No employees found" description="Add your first employee to get started." action="Add Employee" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <Card
              key={emp.id}
              className="p-5 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/30"
              onClick={() => setSelectedEmployee(emp)}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-primary">
                    {emp.first_name?.[0]}{emp.last_name?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">{emp.first_name} {emp.last_name}</h3>
                    <StatusBadge status={emp.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{emp.position}</p>
                  <p className="text-xs text-muted-foreground">{getOrgName(emp.organization_id)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t space-y-1.5">
                {emp.email && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="w-3 h-3" />{emp.email}
                  </div>
                )}
                {emp.employment_type && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground capitalize">
                    <Building2 className="w-3 h-3" />{emp.employment_type.replace('_', ' ')}
                  </div>
                )}
                {emp.start_date && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />Started {format(new Date(emp.start_date), 'd MMM yyyy')}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add New Employee</DialogTitle>
          </DialogHeader>
          <EmployeeForm organizations={orgs} onSubmit={(data) => createMutation.mutate(data)} isLoading={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}