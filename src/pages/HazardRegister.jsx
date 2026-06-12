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
import { Plus, AlertTriangle } from 'lucide-react';

export default function HazardRegister() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: hazards = [] } = useQuery({
    queryKey: ['hazards'],
    queryFn: () => sdList('HazardRegister'),
  });
  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('HazardRegister', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hazards'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));

  return (
    <div>
      <PageHeader title="Hazard Register" subtitle="Workplace hazard identification and controls" actions={<Button onClick={() => { setFormData({ status: 'active' }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Add Hazard</Button>} />

      {hazards.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No hazards recorded" description="Identify and document workplace hazards." action="Add Hazard" onAction={() => setShowAdd(true)} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hazard</TableHead>
                  <TableHead>Area/Location</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Controls</TableHead>
                  <TableHead>Responsible</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hazards.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="font-medium text-sm">{h.hazard_description}</TableCell>
                    <TableCell className="text-sm">{h.area_location}</TableCell>
                    <TableCell><StatusBadge status={h.risk_level} /></TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{h.existing_controls}</TableCell>
                    <TableCell className="text-sm">{h.responsible_person}</TableCell>
                    <TableCell><StatusBadge status={h.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add Hazard</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Organisation</Label><Select value={formData.organization_id || ''} onValueChange={v => update('organization_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Hazard Description *</Label><Textarea value={formData.hazard_description || ''} onChange={e => update('hazard_description', e.target.value)} rows={3} /></div>
            <div><Label>Area/Location</Label><Input value={formData.area_location || ''} onChange={e => update('area_location', e.target.value)} /></div>
            <div><Label>Risk Level</Label><Select value={formData.risk_level || ''} onValueChange={v => update('risk_level', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent></Select></div>
            <div><Label>Existing Controls</Label><Textarea value={formData.existing_controls || ''} onChange={e => update('existing_controls', e.target.value)} rows={2} /></div>
            <div><Label>Further Actions Required</Label><Textarea value={formData.further_actions || ''} onChange={e => update('further_actions', e.target.value)} rows={2} /></div>
            <div><Label>Responsible Person</Label><Input value={formData.responsible_person || ''} onChange={e => update('responsible_person', e.target.value)} /></div>
            <div><Label>Review Date</Label><Input type="date" value={formData.review_date || ''} onChange={e => update('review_date', e.target.value)} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Add Hazard'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}