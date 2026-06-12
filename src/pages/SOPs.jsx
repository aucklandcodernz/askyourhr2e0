import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
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
import { Plus, FileText, Calendar, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function SOPs() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: sops = [] } = useQuery({
    queryKey: ['sops'],
    queryFn: () => sdList('SOPDocument'),
  });
  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('SOPDocument', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sops'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));

  return (
    <div>
      <PageHeader title="SOPs" subtitle="Standard Operating Procedures library" actions={<Button onClick={() => { setFormData({ status: 'draft' }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Add SOP</Button>} />

      {sops.length === 0 ? (
        <EmptyState icon={FileText} title="No SOPs" description="Create your standard operating procedures library." action="Add SOP" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sops.map(sop => (
            <Card key={sop.id} className="hover:shadow-md transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <StatusBadge status={sop.status} />
                </div>
                <h3 className="font-semibold text-sm mb-1">{sop.title}</h3>
                {sop.category && <p className="text-xs text-muted-foreground">{sop.category}</p>}
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span>v{sop.version || '1.0'}</span>
                  {sop.review_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Review: {format(new Date(sop.review_date), 'd MMM yyyy')}</span>}
                </div>
                {sop.acknowledgements?.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-success">
                    <CheckCircle2 className="w-3 h-3" />{sop.acknowledgements.filter(a => a.confirmed).length}/{sop.acknowledgements.length} acknowledged
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add SOP</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Organisation</Label><Select value={formData.organization_id || ''} onValueChange={v => update('organization_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Title *</Label><Input value={formData.title || ''} onChange={e => update('title', e.target.value)} /></div>
            <div><Label>Category</Label><Input value={formData.category || ''} onChange={e => update('category', e.target.value)} placeholder="e.g., Safety, Operations" /></div>
            <div><Label>Version</Label><Input value={formData.version || ''} onChange={e => update('version', e.target.value)} placeholder="e.g., 1.0" /></div>
            <div><Label>Content</Label><Textarea value={formData.content || ''} onChange={e => update('content', e.target.value)} rows={6} /></div>
            <div><Label>Review Date</Label><Input type="date" value={formData.review_date || ''} onChange={e => update('review_date', e.target.value)} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={formData.expiry_date || ''} onChange={e => update('expiry_date', e.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Add SOP'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}