import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sdList, sdCreate, sdUpdate } from '@/lib/secureDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, CalendarDays, CheckCircle2, XCircle } from 'lucide-react';
import { format, differenceInBusinessDays } from 'date-fns';

export default function Leave() {
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['leaveRequests'],
    queryFn: () => sdList('LeaveRequest'),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });
  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('LeaveRequest', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leaveRequests'] }); setShowAdd(false); setFormData({}); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sdUpdate('LeaveRequest', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leaveRequests'] }),
  });

  const update = (f, v) => {
    const updated = { ...formData, [f]: v };
    if (updated.start_date && updated.end_date) {
      updated.total_days = differenceInBusinessDays(new Date(updated.end_date), new Date(updated.start_date)) + 1;
    }
    setFormData(updated);
  };

  const getName = (id) => { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : 'Unknown'; };
  const filtered = requests.filter(r => statusFilter === 'all' || r.status === statusFilter);
  const leaveTypeLabels = { annual: 'Annual Leave', sick: 'Sick Leave', bereavement: 'Bereavement', parental: 'Parental Leave', public_holiday: 'Public Holiday', unpaid: 'Unpaid Leave', other: 'Other' };

  return (
    <div>
      <PageHeader title="Leave Management" subtitle="Leave requests and approvals" actions={<Button onClick={() => { setFormData({ status: 'pending' }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Request Leave</Button>} />

      <div className="flex gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No leave requests" description="Submit leave requests for employees." action="Request Leave" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map(req => (
            <Card key={req.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{getName(req.employee_id)}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{leaveTypeLabels[req.leave_type] || req.leave_type} • {req.total_days || 0} day(s)</p>
                    <p className="text-xs text-muted-foreground">{req.start_date && format(new Date(req.start_date), 'd MMM')} — {req.end_date && format(new Date(req.end_date), 'd MMM yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={req.status} />
                    {req.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: req.id, data: { status: 'approved' } }); }}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: req.id, data: { status: 'rejected' } }); }}>
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Request Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Employee *</Label><Select value={formData.employee_id || ''} onValueChange={v => update('employee_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Leave Type *</Label><Select value={formData.leave_type || ''} onValueChange={v => update('leave_type', v)}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{Object.entries(leaveTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date *</Label><Input type="date" value={formData.start_date || ''} onChange={e => update('start_date', e.target.value)} /></div>
              <div><Label>End Date *</Label><Input type="date" value={formData.end_date || ''} onChange={e => update('end_date', e.target.value)} /></div>
            </div>
            {formData.total_days > 0 && <p className="text-sm text-muted-foreground">{formData.total_days} business day(s)</p>}
            <div><Label>Reason</Label><Textarea value={formData.reason || ''} onChange={e => update('reason', e.target.value)} rows={3} /></div>
            <div><Label>Organisation</Label><Select value={formData.organization_id || ''} onValueChange={v => update('organization_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Submitting...' : 'Submit Request'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}