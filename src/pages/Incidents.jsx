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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Plus, AlertTriangle, Search } from 'lucide-react';
import { format } from 'date-fns';

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function Incidents() {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: incidents = [] } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => sdList('Incident'),
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => base44.entities.Organization.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('Incident', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incidents'] }); setShowAdd(false); setFormData({}); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sdUpdate('Incident', id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['incidents'] }); setSelectedIncident(null); },
  });

  const filtered = incidents
    .filter(i => {
      const matchSearch = !search || i.description?.toLowerCase().includes(search.toLowerCase()) || i.location?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));

  const updateForm = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const severityBg = { low: 'border-l-green-400', medium: 'border-l-amber-400', high: 'border-l-orange-400', critical: 'border-l-red-500' };

  return (
    <div>
      <PageHeader
        title="H&S Incidents"
        subtitle="Health & Safety incident reporting and management"
        actions={<Button onClick={() => { setFormData({ status: 'open' }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Report Incident</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search incidents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="corrective_actions">Corrective Actions</SelectItem>
            <SelectItem value="pending_closure">Pending Closure</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No incidents reported" description="All clear! Report an incident if one occurs." />
      ) : (
        <div className="space-y-3">
          {filtered.map(inc => (
            <Card
              key={inc.id}
              className={`border-l-4 ${severityBg[inc.severity] || 'border-l-slate-300'} cursor-pointer hover:shadow-md transition-all`}
              onClick={() => setSelectedIncident(inc)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={inc.severity} />
                      <StatusBadge status={inc.status} />
                      <span className="text-xs text-muted-foreground capitalize">{inc.incident_type?.replace('_', ' ')}</span>
                    </div>
                    <p className="text-sm font-medium">{inc.description?.substring(0, 120)}{inc.description?.length > 120 ? '...' : ''}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {inc.location && <span>📍 {inc.location}</span>}
                      {inc.date_time && <span>🕐 {format(new Date(inc.date_time), 'd MMM yyyy HH:mm')}</span>}
                    </div>
                  </div>
                  {inc.notifiable_event && (
                    <div className="px-2 py-1 bg-red-100 rounded text-xs font-medium text-red-700">WorkSafe Notifiable</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report Incident Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Report Incident</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Organisation *</Label>
              <Select value={formData.organization_id || ''} onValueChange={v => updateForm('organization_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select organisation" /></SelectTrigger>
                <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Incident Type *</Label>
              <Select value={formData.incident_type || ''} onValueChange={v => updateForm('incident_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="incident">Incident</SelectItem>
                  <SelectItem value="near_miss">Near Miss</SelectItem>
                  <SelectItem value="injury">Injury</SelectItem>
                  <SelectItem value="property_damage">Property Damage</SelectItem>
                  <SelectItem value="unsafe_behaviour">Unsafe Behaviour</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Date & Time</Label><Input type="datetime-local" value={formData.date_time || ''} onChange={e => updateForm('date_time', e.target.value)} /></div>
              <div><Label>Location</Label><Input value={formData.location || ''} onChange={e => updateForm('location', e.target.value)} /></div>
            </div>
            <div><Label>Description *</Label><Textarea value={formData.description || ''} onChange={e => updateForm('description', e.target.value)} rows={4} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>People Involved</Label><Input value={formData.people_involved || ''} onChange={e => updateForm('people_involved', e.target.value)} /></div>
              <div><Label>Witnesses</Label><Input value={formData.witnesses || ''} onChange={e => updateForm('witnesses', e.target.value)} /></div>
            </div>
            <Separator />
            <h3 className="font-display font-semibold text-sm">Risk Assessment</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Severity</Label>
                <Select value={formData.severity || ''} onValueChange={v => updateForm('severity', v)}>
                  <SelectTrigger><SelectValue placeholder="Select severity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Likelihood</Label>
                <Select value={formData.likelihood || ''} onValueChange={v => updateForm('likelihood', v)}>
                  <SelectTrigger><SelectValue placeholder="Select likelihood" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlikely">Unlikely</SelectItem>
                    <SelectItem value="possible">Possible</SelectItem>
                    <SelectItem value="likely">Likely</SelectItem>
                    <SelectItem value="almost_certain">Almost Certain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Medical treatment required?</Label>
                <Switch checked={formData.medical_treatment_required || false} onCheckedChange={v => updateForm('medical_treatment_required', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Lost time injury?</Label>
                <Switch checked={formData.lost_time_injury || false} onCheckedChange={v => updateForm('lost_time_injury', v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Notifiable event (under NZ HSWA)?</Label>
                <Switch checked={formData.notifiable_event || false} onCheckedChange={v => updateForm('notifiable_event', v)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedIncident && (
            <>
              <DialogHeader><DialogTitle className="font-display">Incident Details</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <StatusBadge status={selectedIncident.severity} />
                  <StatusBadge status={selectedIncident.status} />
                  <span className="text-xs text-muted-foreground capitalize">{selectedIncident.incident_type?.replace('_', ' ')}</span>
                </div>
                <p className="text-sm">{selectedIncident.description}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Location:</span> {selectedIncident.location}</div>
                  <div><span className="text-muted-foreground">Date:</span> {selectedIncident.date_time ? format(new Date(selectedIncident.date_time), 'd MMM yyyy HH:mm') : 'N/A'}</div>
                  <div><span className="text-muted-foreground">People involved:</span> {selectedIncident.people_involved || 'N/A'}</div>
                  <div><span className="text-muted-foreground">Witnesses:</span> {selectedIncident.witnesses || 'N/A'}</div>
                </div>
                {selectedIncident.notifiable_event && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-red-800">⚠️ This may be a notifiable event under NZ HSWA</p>
                    <p className="text-xs text-red-600 mt-1">WorkSafe NZ may need to be notified. Review legal requirements.</p>
                    <div className="flex items-center gap-3 mt-2">
                      <Label className="text-xs text-red-700">WorkSafe Notified?</Label>
                      <Switch
                        checked={selectedIncident.worksafe_notified || false}
                        onCheckedChange={v => updateMutation.mutate({ id: selectedIncident.id, data: { worksafe_notified: v, worksafe_notification_date: v ? new Date().toISOString().split('T')[0] : null } })}
                      />
                    </div>
                  </div>
                )}
                <Separator />
                <div>
                  <Label>Update Status</Label>
                  <Select value={selectedIncident.status} onValueChange={v => updateMutation.mutate({ id: selectedIncident.id, data: { status: v } })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="corrective_actions">Corrective Actions</SelectItem>
                      <SelectItem value="pending_closure">Pending Closure</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Investigation Notes</Label>
                  <Textarea
                    value={selectedIncident.investigation_notes || ''}
                    onChange={e => updateMutation.mutate({ id: selectedIncident.id, data: { investigation_notes: e.target.value } })}
                    rows={3}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}