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
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function RiskRegister() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: risks = [] } = useQuery({
    queryKey: ['risks'],
    queryFn: () => sdList('RiskRegister'),
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('RiskRegister', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['risks'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));

  return (
    <div>
      <PageHeader title="Risk Register" subtitle="Identified risks, controls, and review schedule" actions={<Button onClick={() => { setFormData({ status: 'active' }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Add Risk</Button>} />

      {risks.length === 0 ? (
        <EmptyState icon={Shield} title="No risks recorded" description="Add identified risks to track and manage." action="Add Risk" onAction={() => setShowAdd(true)} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Risk</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Controls</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {risks.map(risk => (
                  <TableRow key={risk.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{risk.title}</p>
                        <p className="text-xs text-muted-foreground">{risk.description?.substring(0, 60)}</p>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={risk.risk_level} /></TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{risk.controls}</TableCell>
                    <TableCell className="text-sm">{risk.responsible_person}</TableCell>
                    <TableCell className="text-sm">{risk.review_date ? format(new Date(risk.review_date), 'd MMM yyyy') : '-'}</TableCell>
                    <TableCell><StatusBadge status={risk.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add Risk</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Organisation</Label><Select value={formData.organization_id || ''} onValueChange={v => update('organization_id', v)}><SelectTrigger><SelectValue placeholder="Select org" /></SelectTrigger><SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Title *</Label><Input value={formData.title || ''} onChange={e => update('title', e.target.value)} /></div>
            <div><Label>Description</Label><Textarea value={formData.description || ''} onChange={e => update('description', e.target.value)} rows={3} /></div>
            <div><Label>Category</Label><Input value={formData.category || ''} onChange={e => update('category', e.target.value)} placeholder="e.g., Operational, Financial, H&S" /></div>
            <div><Label>Risk Level</Label><Select value={formData.risk_level || ''} onValueChange={v => update('risk_level', v)}><SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
            <div><Label>Controls</Label><Textarea value={formData.controls || ''} onChange={e => update('controls', e.target.value)} rows={2} /></div>
            <div><Label>Responsible Person</Label><Input value={formData.responsible_person || ''} onChange={e => update('responsible_person', e.target.value)} /></div>
            <div><Label>Review Date</Label><Input type="date" value={formData.review_date || ''} onChange={e => update('review_date', e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Add Risk'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}