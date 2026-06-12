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
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Scale, AlertCircle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

export default function Disciplinary() {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [formData, setFormData] = useState({});
  const queryClient = useQueryClient();

  const { data: cases = [] } = useQuery({
    queryKey: ['disciplinary'],
    queryFn: () => sdList('DisciplinaryCase'),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => sdCreate('DisciplinaryCase', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['disciplinary'] }); setShowAdd(false); setFormData({}); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sdUpdate('DisciplinaryCase', id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['disciplinary'] }),
  });

  const update = (f, v) => setFormData(p => ({ ...p, [f]: v }));
  const getName = (id) => { const e = employees.find(e => e.id === id); return e ? `${e.first_name} ${e.last_name}` : 'Unknown'; };

  const issueLabels = { misconduct: 'Misconduct', serious_misconduct: 'Serious Misconduct', attendance: 'Attendance', breach_of_policy: 'Breach of Policy', hs_breach: 'H&S Breach', performance: 'Performance' };

  return (
    <div>
      <PageHeader title="Disciplinary Management" subtitle="Disciplinary cases, investigations, and outcomes" actions={<Button onClick={() => { setFormData({ status: 'logged', date_identified: format(new Date(), 'yyyy-MM-dd'), compliance_checklist: {} }); setShowAdd(true); }}><Plus className="w-4 h-4 mr-2" />Log Issue</Button>} />

      {cases.length === 0 ? (
        <EmptyState icon={Scale} title="No disciplinary cases" description="Log disciplinary issues when they arise." />
      ) : (
        <div className="space-y-3">
          {cases.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-all" onClick={() => setSelectedCase(c)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-sm">{getName(c.employee_id)}</h3>
                      <span className="text-xs text-muted-foreground">— {issueLabels[c.issue_type] || c.issue_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    {c.outcome && <StatusBadge status={c.outcome} />}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Log Issue Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display">Log Disciplinary Issue</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Employee *</Label><Select value={formData.employee_id || ''} onValueChange={v => update('employee_id', v)}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e.id} value={e.id}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Issue Type *</Label><Select value={formData.issue_type || ''} onValueChange={v => update('issue_type', v)}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{Object.entries(issueLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Description *</Label><Textarea value={formData.description || ''} onChange={e => update('description', e.target.value)} rows={4} /></div>
            <div><Label>Date Identified</Label><Input type="date" value={formData.date_identified || ''} onChange={e => update('date_identified', e.target.value)} /></div>
            <div><Label>Organisation</Label><Input value={formData.organization_id || ''} onChange={e => update('organization_id', e.target.value)} placeholder="Organisation ID" /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending}>{createMutation.isPending ? 'Saving...' : 'Log Issue'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedCase && (
            <>
              <DialogHeader><DialogTitle className="font-display">Disciplinary Case</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{getName(selectedCase.employee_id)}</h3>
                  <StatusBadge status={selectedCase.status} />
                  {selectedCase.outcome && <StatusBadge status={selectedCase.outcome} />}
                </div>
                <p className="text-sm">{selectedCase.description}</p>
                <Separator />
                <h4 className="font-display font-semibold text-sm">Update Status</h4>
                <Select value={selectedCase.status} onValueChange={v => { updateMutation.mutate({ id: selectedCase.id, data: { status: v } }); setSelectedCase(prev => ({ ...prev, status: v })); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logged">Logged</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="meeting_scheduled">Meeting Scheduled</SelectItem>
                    <SelectItem value="outcome_pending">Outcome Pending</SelectItem>
                    <SelectItem value="warning_issued">Warning Issued</SelectItem>
                    <SelectItem value="pip_issued">PIP Issued</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                <h4 className="font-display font-semibold text-sm">Outcome</h4>
                <Select value={selectedCase.outcome || ''} onValueChange={v => { updateMutation.mutate({ id: selectedCase.id, data: { outcome: v } }); setSelectedCase(prev => ({ ...prev, outcome: v })); }}>
                  <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no_action">No Further Action</SelectItem>
                    <SelectItem value="informal_warning">Informal Warning</SelectItem>
                    <SelectItem value="first_warning">First Warning</SelectItem>
                    <SelectItem value="final_warning">Final Warning</SelectItem>
                    <SelectItem value="dismissal">Dismissal</SelectItem>
                    <SelectItem value="training_coaching">Training/Coaching</SelectItem>
                  </SelectContent>
                </Select>
                <Separator />
                <h4 className="font-display font-semibold text-sm">Compliance Checklist</h4>
                <div className="space-y-2">
                  {[
                    ['proper_process', 'Proper process followed'],
                    ['investigation_completed', 'Investigation completed'],
                    ['right_to_respond', 'Right to respond provided'],
                    ['documentation_attached', 'Required documentation attached'],
                  ].map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedCase.compliance_checklist?.[key] || false}
                        onCheckedChange={v => {
                          const checklist = { ...selectedCase.compliance_checklist, [key]: v };
                          updateMutation.mutate({ id: selectedCase.id, data: { compliance_checklist: checklist } });
                          setSelectedCase(prev => ({ ...prev, compliance_checklist: checklist }));
                        }}
                      />
                      <Label className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
                {selectedCase.compliance_checklist && Object.values(selectedCase.compliance_checklist).some(v => !v) && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <p className="text-xs text-amber-800">Not all compliance steps are complete. Ensure all items are checked before proceeding.</p>
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