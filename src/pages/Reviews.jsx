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
import { Plus, ClipboardList, Star } from 'lucide-react';

export default function Reviews() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => sdList('PerformanceReview'),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('PerformanceReview', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reviews'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const getName = (id) => { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : 'Unknown'; };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`w-3.5 h-3.5 ${i < (rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
    ));
  };

  return (
    <div>
      <PageHeader title="Performance Reviews" subtitle="Employee performance reviews and feedback" actions={<Button onClick={() => { setFormData({ status: 'draft' }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />New Review</Button>} />

      {reviews.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No reviews" description="Create performance reviews for employees." action="New Review" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="space-y-3">
          {reviews.map(review => (
            <Card key={review.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">{getName(review.employee_id)}</h3>
                    <p className="text-xs text-muted-foreground capitalize mt-0.5">{review.type} Review{review.period && ` — ${review.period}`}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex">{renderStars(review.overall_rating)}</div>
                    <StatusBadge status={review.status} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">New Performance Review</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Employee *</Label><Select value={formData.employee_id || ''} onValueChange={v => update('employee_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Organisation</Label><Input value={formData.organization_id || ''} onChange={e => update('organization_id', e.target.value)} placeholder="Organisation ID" /></div>
            <div><Label>Review Type *</Label><Select value={formData.type || ''} onValueChange={v => update('type', v)}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly Check-in</SelectItem><SelectItem value="quarterly">Quarterly Review</SelectItem><SelectItem value="annual">Annual Review</SelectItem><SelectItem value="probation">Probation Review</SelectItem></SelectContent></Select></div>
            <div><Label>Period</Label><Input value={formData.period || ''} onChange={e => update('period', e.target.value)} placeholder="e.g., Q1 2026" /></div>
            <div><Label>Overall Rating (1-5)</Label><Input type="number" min="1" max="5" value={formData.overall_rating || ''} onChange={e => update('overall_rating', parseInt(e.target.value))} /></div>
            <div><Label>Strengths</Label><Textarea value={formData.strengths || ''} onChange={e => update('strengths', e.target.value)} rows={3} /></div>
            <div><Label>Areas for Improvement</Label><Textarea value={formData.areas_for_improvement || ''} onChange={e => update('areas_for_improvement', e.target.value)} rows={3} /></div>
            <div><Label>Development Plan</Label><Textarea value={formData.development_plan || ''} onChange={e => update('development_plan', e.target.value)} rows={3} /></div>
            <div><Label>Feedback Notes</Label><Textarea value={formData.feedback_notes || ''} onChange={e => update('feedback_notes', e.target.value)} rows={3} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create Review'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}