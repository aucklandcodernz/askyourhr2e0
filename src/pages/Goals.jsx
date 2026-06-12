import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Progress } from '@/components/ui/progress';
import { Plus, Target } from 'lucide-react';
import { format } from 'date-fns';

export default function Goals() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => sdList('PerformanceGoal'),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('PerformanceGoal', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['goals'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const getEmployeeName = (id) => { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : 'Unknown'; };

  return (
    <div>
      <PageHeader title="Goals & KPIs" subtitle="Performance goals and development objectives" actions={<Button onClick={() => { setFormData({ status: 'not_started', progress: 0 }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Add Goal</Button>} />

      {goals.length === 0 ? (
        <EmptyState icon={Target} title="No goals set" description="Create KPIs and goals for employees." action="Add Goal" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {goals.map(goal => (
            <Card key={goal.id} className="hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{goal.title}</h3>
                    <p className="text-xs text-muted-foreground">{getEmployeeName(goal.employee_id)}</p>
                  </div>
                  <StatusBadge status={goal.status} />
                </div>
                {goal.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{goal.description}</p>}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground capitalize">{goal.type}</span>
                  <span className="text-xs font-semibold">{goal.progress || 0}%</span>
                </div>
                <Progress value={goal.progress || 0} className="h-1.5" />
                {goal.due_date && <p className="text-xs text-muted-foreground mt-2">Due: {format(new Date(goal.due_date), 'd MMM yyyy')}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add Goal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Employee *</Label><Select value={formData.employee_id || ''} onValueChange={v => update('employee_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Organisation</Label><Input value={formData.organization_id || ''} onChange={e => update('organization_id', e.target.value)} placeholder="Organisation ID" /></div>
            <div><Label>Title *</Label><Input value={formData.title || ''} onChange={e => update('title', e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={formData.description || ''} onChange={e => update('description', e.target.value)} rows={3} /></div>
            <div><Label>Type</Label><Select value={formData.type || ''} onValueChange={v => update('type', v)}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="kpi">KPI</SelectItem><SelectItem value="goal">Goal</SelectItem><SelectItem value="development">Development</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div><Label>Target</Label><Input value={formData.target || ''} onChange={e => update('target', e.target.value)} placeholder="e.g., Complete 5 projects" /></div>
            <div><Label>Due Date</Label><Input type="date" value={formData.due_date || ''} onChange={e => update('due_date', e.target.value)} /></div>
            <div><Label>Review Period</Label><Input value={formData.review_period || ''} onChange={e => update('review_period', e.target.value)} placeholder="e.g., Q1 2026" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Add Goal'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}