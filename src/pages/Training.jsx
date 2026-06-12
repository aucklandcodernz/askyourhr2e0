import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdList, sdCreate } from '@/lib/secureDataClient';
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
import { Plus, GraduationCap, Calendar, AlertCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function Training() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: training = [] } = useQuery({
    queryKey: ['training'],
    queryFn: () => sdList('Training'),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('Training', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['training'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const getName = (id) => { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : 'Unknown'; };

  const expiringSoon = training.filter(t => {
    if (!t.expiry_date) return false;
    const days = differenceInDays(new Date(t.expiry_date), new Date());
    return days > 0 && days <= 30;
  });

  return (
    <div>
      <PageHeader title="Training & Development" subtitle="Manage training assignments and certifications" actions={<Button onClick={() => { setFormData({ status: 'assigned', assigned_date: format(new Date(), 'yyyy-MM-dd') }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Assign Training</Button>} />

      {expiringSoon.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 mb-6 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">{expiringSoon.length} training item(s) expiring within 30 days</p>
        </div>
      )}

      {training.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No training records" description="Assign training courses and certifications." action="Assign Training" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="space-y-3">
          {training.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{t.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{getName(t.employee_id)} • <span className="capitalize">{t.type?.replace('_', ' ')}</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.expiry_date && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />Expires {format(new Date(t.expiry_date), 'd MMM yyyy')}
                      </span>
                    )}
                    <StatusBadge status={t.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Assign Training</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Employee *</Label><Select value={formData.employee_id || ''} onValueChange={v => update('employee_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Organisation</Label><Input value={formData.organization_id || ''} onChange={e => update('organization_id', e.target.value)} placeholder="Organisation ID" /></div>
            <div><Label>Title *</Label><Input value={formData.title || ''} onChange={e => update('title', e.target.value)} /></div>
            <div><Label>Type</Label><Select value={formData.type || ''} onValueChange={v => update('type', v)}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="course">Course</SelectItem><SelectItem value="sop_review">SOP Review</SelectItem><SelectItem value="compliance">Compliance</SelectItem><SelectItem value="certification">Certification</SelectItem><SelectItem value="induction">Induction</SelectItem><SelectItem value="hs_training">H&S Training</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div><Label>Due Date</Label><Input type="date" value={formData.due_date || ''} onChange={e => update('due_date', e.target.value)} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={formData.expiry_date || ''} onChange={e => update('expiry_date', e.target.value)} /></div>
            <div><Label>Notes</Label><Textarea value={formData.notes || ''} onChange={e => update('notes', e.target.value)} rows={3} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Assign'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}