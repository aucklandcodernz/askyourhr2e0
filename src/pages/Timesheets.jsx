import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sdList, sdCreate, sdUpdate } from '@/lib/secureDataClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Plus, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';

export default function Timesheets() {
  const [showAdd, setShowAdd] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTs, setSelectedTs] = useState(null);
  const [newTs, setNewTs] = useState({});
  const queryClient = useQueryClient();

  const { data: timesheets = [] } = useQuery({
    queryKey: ['timesheets'],
    queryFn: () => sdList('Timesheet'),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('Timesheet', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); setShowAdd(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sdUpdate('Timesheet', id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['timesheets'] }); },
  });

  const filtered = timesheets.filter(t => statusFilter === 'all' || t.status === statusFilter);

  const getEmployeeName = (id) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
  };

  const initNewTimesheet = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const entries = Array.from({ length: 7 }, (_, i) => ({
      date: format(addDays(weekStart, i), 'yyyy-MM-dd'),
      start_time: '', end_time: '', break_minutes: 30, total_hours: 0, location: '', notes: ''
    }));
    setNewTs({ employee_id: '', organization_id: '', period_start: format(weekStart, 'yyyy-MM-dd'), period_end: format(addDays(weekStart, 6), 'yyyy-MM-dd'), entries, status: 'draft', total_hours: 0, overtime_hours: 0 });
    setShowAdd(true);
  };

  const handleSubmitTimesheet = (ts) => {
    const totalHours = (ts.entries || []).reduce((sum, e) => sum + (e.total_hours || 0), 0);
    createMutation.mutate({ ...ts, total_hours: totalHours });
  };

  const handleApprove = (ts) => {
    updateMutation.mutate({ id: ts.id, data: { status: 'approved', review_date: new Date().toISOString() } });
  };

  const handleReject = (ts) => {
    updateMutation.mutate({ id: ts.id, data: { status: 'rejected', review_comments: 'Needs revision', review_date: new Date().toISOString() } });
  };

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Employee time tracking and approval"
        actions={<Button onClick={initNewTimesheet}><Plus className="w-4 h-4 mr-2" />New Timesheet</Button>}
      />

      <div className="flex gap-3 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="locked">Locked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Clock} title="No timesheets" description="Create a timesheet to start tracking hours." action="New Timesheet" onAction={initNewTimesheet} />
      ) : (
        <div className="space-y-3">
          {filtered.map(ts => (
            <Card key={ts.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => setSelectedTs(ts)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{getEmployeeName(ts.employee_id)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ts.period_start && format(new Date(ts.period_start), 'd MMM')} — {ts.period_end && format(new Date(ts.period_end), 'd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{ts.total_hours || 0}h</span>
                    <StatusBadge status={ts.status} />
                  </div>
                </div>
                {ts.employee_declaration && (
                  <p className="text-[10px] text-success mt-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Employee declared</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Timesheet Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">New Timesheet</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Employee *</Label>
                <Select value={newTs.employee_id || ''} onValueChange={v => setNewTs(p => ({ ...p, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Organisation</Label>
                <Select value={newTs.organization_id || ''} onValueChange={v => setNewTs(p => ({ ...p, organization_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select org" /></SelectTrigger>
                  <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Period Start</Label><Input type="date" value={newTs.period_start || ''} onChange={e => setNewTs(p => ({ ...p, period_start: e.target.value }))} /></div>
              <div><Label>Period End</Label><Input type="date" value={newTs.period_end || ''} onChange={e => setNewTs(p => ({ ...p, period_end: e.target.value }))} /></div>
            </div>
            <Separator />
            <h3 className="font-display font-semibold text-sm">Daily Entries</h3>
            <div className="space-y-2">
              {(newTs.entries || []).map((entry, i) => (
                <div key={i} className="grid grid-cols-5 gap-2 items-end p-2 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-[10px]">{entry.date ? format(new Date(entry.date), 'EEE d MMM') : `Day ${i + 1}`}</Label>
                  </div>
                  <div><Input type="time" value={entry.start_time} onChange={e => { const entries = [...newTs.entries]; entries[i].start_time = e.target.value; setNewTs(p => ({ ...p, entries })); }} placeholder="Start" className="h-8 text-xs" /></div>
                  <div><Input type="time" value={entry.end_time} onChange={e => { const entries = [...newTs.entries]; entries[i].end_time = e.target.value; setNewTs(p => ({ ...p, entries })); }} placeholder="End" className="h-8 text-xs" /></div>
                  <div><Input type="number" value={entry.break_minutes} onChange={e => { const entries = [...newTs.entries]; entries[i].break_minutes = parseInt(e.target.value) || 0; setNewTs(p => ({ ...p, entries })); }} placeholder="Break (min)" className="h-8 text-xs" /></div>
                  <div><Input type="number" step="0.25" value={entry.total_hours} onChange={e => { const entries = [...newTs.entries]; entries[i].total_hours = parseFloat(e.target.value) || 0; setNewTs(p => ({ ...p, entries })); }} placeholder="Hours" className="h-8 text-xs" /></div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => handleSubmitTimesheet(newTs)} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save Timesheet'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Timesheet Detail Dialog */}
      <Dialog open={!!selectedTs} onOpenChange={() => setSelectedTs(null)}>
        <DialogContent className="max-w-lg">
          {selectedTs && (
            <>
              <DialogHeader><DialogTitle className="font-display">Timesheet Review</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="font-medium">{getEmployeeName(selectedTs.employee_id)}</p>
                  <StatusBadge status={selectedTs.status} />
                </div>
                <p className="text-sm text-muted-foreground">{selectedTs.period_start && format(new Date(selectedTs.period_start), 'd MMM')} — {selectedTs.period_end && format(new Date(selectedTs.period_end), 'd MMM yyyy')}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Total Hours:</span> <strong>{selectedTs.total_hours || 0}h</strong></div>
                  <div><span className="text-muted-foreground">Overtime:</span> <strong>{selectedTs.overtime_hours || 0}h</strong></div>
                </div>
                {selectedTs.employee_declaration && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                    <p className="text-xs text-emerald-800 font-medium">✓ Employee declaration confirmed</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">"I confirm that the hours submitted are accurate and I am satisfied with the hours to be paid."</p>
                    {selectedTs.declaration_timestamp && <p className="text-[10px] text-emerald-600 mt-0.5">Declared: {format(new Date(selectedTs.declaration_timestamp), 'd MMM yyyy HH:mm')}</p>}
                  </div>
                )}
                {selectedTs.status === 'submitted' && (
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => { handleApprove(selectedTs); setSelectedTs(null); }}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Approve
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => { handleReject(selectedTs); setSelectedTs(null); }}>
                      <XCircle className="w-4 h-4 mr-1" />Reject
                    </Button>
                  </div>
                )}
                {selectedTs.review_comments && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-xs font-medium text-amber-800">Review Comments:</p>
                    <p className="text-xs text-amber-700 mt-1">{selectedTs.review_comments}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}