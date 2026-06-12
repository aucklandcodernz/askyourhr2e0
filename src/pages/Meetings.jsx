import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { sdList, sdCreate } from '@/lib/secureDataClient';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus, BookOpen, Calendar, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function Meetings() {
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: meetings = [] } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => sdList('Meeting'),
  });
  const { data: orgs = [] } = useQuery({ queryKey: ['organizations'], queryFn: () => base44.entities.Organization.list() });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('Meeting', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['meetings'] }); setShowAdd(false); setFormData({}); },
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const typeLabel = { toolbox: 'Toolbox Talk', safety: 'Safety Meeting', staff: 'Staff Meeting', other: 'Other' };

  return (
    <div>
      <PageHeader title="Meetings" subtitle="Toolbox talks, safety meetings, and minutes" actions={<Button onClick={() => { setFormData({}); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />New Meeting</Button>} />

      {meetings.length === 0 ? (
        <EmptyState icon={BookOpen} title="No meetings recorded" description="Create toolbox meetings and safety meetings." action="New Meeting" onAction={() => setShowAdd(true)} />
      ) : (
        <div className="space-y-3">
          {meetings.map(m => (
            <Card key={m.id} className="hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{m.title}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">{typeLabel[m.type] || m.type}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {m.date_time && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(m.date_time), 'd MMM yyyy HH:mm')}</span>}
                      {m.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{m.location}</span>}
                      {m.attendees && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{m.attendees.length} attendees</span>}
                    </div>
                  </div>
                </div>
                {m.topics_discussed && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{m.topics_discussed}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">New Meeting</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Organisation</Label><Select value={formData.organization_id || ''} onValueChange={v => update('organization_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Title *</Label><Input value={formData.title || ''} onChange={e => update('title', e.target.value)} /></div>
            <div><Label>Type</Label><Select value={formData.type || ''} onValueChange={v => update('type', v)}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent><SelectItem value="toolbox">Toolbox Talk</SelectItem><SelectItem value="safety">Safety Meeting</SelectItem><SelectItem value="staff">Staff Meeting</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date & Time</Label><Input type="datetime-local" value={formData.date_time || ''} onChange={e => update('date_time', e.target.value)} /></div>
              <div><Label>Location</Label><Input value={formData.location || ''} onChange={e => update('location', e.target.value)} /></div>
            </div>
            <div><Label>Topics Discussed</Label><Textarea value={formData.topics_discussed || ''} onChange={e => update('topics_discussed', e.target.value)} rows={3} /></div>
            <div><Label>Hazards Raised</Label><Textarea value={formData.hazards_raised || ''} onChange={e => update('hazards_raised', e.target.value)} rows={2} /></div>
            <div><Label>Minutes</Label><Textarea value={formData.minutes || ''} onChange={e => update('minutes', e.target.value)} rows={4} /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Create Meeting'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}