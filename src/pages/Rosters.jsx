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
import { Plus, CalendarDays } from 'lucide-react';
import { format, startOfWeek } from 'date-fns';

export default function Rosters() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: rosters = [] } = useQuery({
    queryKey: ['rosters'],
    queryFn: () => sdList('Roster'),
  });
  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('Roster', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['rosters'] }); setShowAdd(false); setFormData({}); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sdUpdate('Roster', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rosters'] }),
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));

  const initRoster = () => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    setFormData({ organization_id: '', week_start: format(ws, 'yyyy-MM-dd'), status: 'draft', shifts: [] });
    setShowAdd(true);
  };

  const getOrgName = (id) => orgs.find(o => o.id === id)?.name || '';

  return (
    <div>
      <PageHeader title="Rosters" subtitle="Weekly shift rosters and scheduling" actions={<Button onClick={initRoster}><Plus className="w-4 h-4 mr-2" />New Roster</Button>} />

      {rosters.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No rosters" description="Create weekly rosters for your teams." action="New Roster" onAction={initRoster} />
      ) : (
        <div className="space-y-3">
          {rosters.map(roster => (
            <Card key={roster.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Week of {roster.week_start && format(new Date(roster.week_start), 'd MMM yyyy')}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{getOrgName(roster.organization_id)} • {roster.shifts?.length || 0} shifts</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={roster.status} />
                    {roster.status === 'draft' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: roster.id, data: { status: 'published' } }); }}>
                        Publish
                      </Button>
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
          <DialogHeader><DialogTitle className="font-display">New Roster</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Organisation *</Label><Select value={formData.organization_id || ''} onValueChange={v => update('organization_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Week Starting</Label><Input type="date" value={formData.week_start || ''} onChange={e => update('week_start', e.target.value)} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Creating...' : 'Create Roster'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}