import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyContext as getMyContextFn } from '@/functions/getMyContext';
import { sdList } from '@/lib/secureDataClient';
import { listMembers, grantMembership, changeRole, revokeMembership } from '@/lib/manageAccessClient';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Users, UserCog, Trash2 } from 'lucide-react';

// Policy mirror — kept IDENTICAL to the manageAccess backend. UX only; the
// backend is the real fail-closed authority and re-checks every operation.
const GRANTABLE = {
  owner:         ['agency_admin', 'org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'],
  agency_admin:  ['org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'],
  org_admin:     ['org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'],
  hr_manager:    ['employee'],
  payroll_admin: [],
  team_leader:   [],
  employee:      [],
};
const ROLE_LABEL = {
  owner: 'Owner', agency_admin: 'Agency Admin', org_admin: 'Org Admin', hr_manager: 'HR Manager',
  payroll_admin: 'Payroll Admin', team_leader: 'Team Leader', employee: 'Employee',
};

const EMPTY_FORM = { user_email: '', role: '', employee_id: '__none__' };

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function Members() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [revokeTarget, setRevokeTarget] = useState(null);

  const { data: myContext, isLoading: contextLoading } = useQuery({
    queryKey: ['myContext'],
    queryFn: async () => (await getMyContextFn({})).data,
  });

  // Resolves org names + builds the selector (already gateway-scoped).
  const { data: orgs = [] } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => sdList('Organization'),
  });

  // For the optional employee link in the Add dialog.
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees'],
    queryFn: () => sdList('Employee'),
  });

  // Manageable orgs: platform -> all orgs; else the caller's scoped org ids.
  const manageableOrgs = useMemo(() => {
    if (!myContext) return [];
    const ids = myContext.scope_level === 'platform'
      ? orgs.map(o => o.id)
      : (Array.isArray(myContext.organization_ids) ? myContext.organization_ids : []);
    return ids.map(id => {
      const o = orgs.find(x => x.id === id);
      return { id, name: o ? o.name : id };
    });
  }, [myContext, orgs]);

  // Default to the first manageable org; keep selection valid as scope loads.
  useEffect(() => {
    if (manageableOrgs.length > 0 && !manageableOrgs.some(o => o.id === selectedOrgId)) {
      setSelectedOrgId(manageableOrgs[0].id);
    }
  }, [manageableOrgs, selectedOrgId]);

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members', selectedOrgId],
    queryFn: () => listMembers(selectedOrgId),
    enabled: !!selectedOrgId,
  });

  const orgEmployees = useMemo(
    () => allEmployees.filter(e => e.organization_id === selectedOrgId),
    [allEmployees, selectedOrgId]
  );
  const employeeName = (id) => {
    const e = allEmployees.find(x => x.id === id);
    return e ? (e.full_name || e.id) : null;
  };

  // Grantor role for the selected org -> which roles we may assign/touch.
  const grantorRole = useMemo(() => {
    if (!myContext) return null;
    if (myContext.scope_level === 'platform') return 'owner';
    if (myContext.scope_level === 'agency') return 'agency_admin';
    return myContext.memberships?.find(m => m.organization_id === selectedOrgId)?.role || null;
  }, [myContext, selectedOrgId]);

  const grantableRoles = GRANTABLE[grantorRole] || [];
  const canManage = grantableRoles.length > 0;

  const invalidateMembers = () => queryClient.invalidateQueries({ queryKey: ['members', selectedOrgId] });
  const onError = (err) => toast({
    variant: 'destructive',
    title: 'Action failed',
    description: err?.response?.data?.error || err?.message || 'Please try again',
  });

  const grantMutation = useMutation({
    mutationFn: (payload) => grantMembership(payload),
    onSuccess: () => {
      toast({ title: 'Member added' });
      invalidateMembers();
      setShowAdd(false);
      setForm(EMPTY_FORM);
    },
    onError,
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ membership_id, role }) => changeRole(membership_id, role),
    onSuccess: () => { toast({ title: 'Role updated' }); invalidateMembers(); },
    onError,
  });

  const revokeMutation = useMutation({
    mutationFn: (membership_id) => revokeMembership(membership_id),
    onSuccess: () => { toast({ title: 'Member revoked' }); invalidateMembers(); setRevokeTarget(null); },
    onError,
  });

  const submitGrant = () => {
    const payload = {
      user_email: form.user_email.trim(),
      organization_id: selectedOrgId,
      role: form.role,
    };
    if (form.employee_id && form.employee_id !== '__none__') {
      payload.employee_id = form.employee_id;
    }
    grantMutation.mutate(payload);
  };

  const busy = grantMutation.isPending || changeRoleMutation.isPending || revokeMutation.isPending;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle="Manage who has access to each organisation"
        actions={canManage && selectedOrgId ? (
          <Button onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Member
          </Button>
        ) : null}
      />

      {contextLoading ? (
        <Spinner />
      ) : manageableOrgs.length === 0 ? (
        <EmptyState icon={Users} title="No organisations" description="You don't have any organisations to manage." />
      ) : (
        <>
          {manageableOrgs.length > 1 ? (
            <div className="mb-5 max-w-sm">
              <Label>Organisation</Label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {manageableOrgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Organisation</p>
              <p className="font-semibold text-sm mt-0.5">{manageableOrgs[0]?.name}</p>
            </div>
          )}

          {(!selectedOrgId || membersLoading) ? (
            <Spinner />
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No members"
              description="No one has access to this organisation yet."
              {...(canManage ? { action: 'Add Member', onAction: () => { setForm(EMPTY_FORM); setShowAdd(true); } } : {})}
            />
          ) : (
            <div className="space-y-2">
              {members.map(m => {
                const editable = canManage && grantableRoles.includes(m.role);
                const linkedName = m.employee_id ? employeeName(m.employee_id) : null;
                return (
                  <Card key={m.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <UserCog className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate">{m.user_email}</span>
                          <StatusBadge status={m.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {ROLE_LABEL[m.role] || m.role}
                          {linkedName && <span> • Linked to {linkedName}</span>}
                        </p>
                      </div>
                      {editable && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Select
                            value={m.role}
                            onValueChange={(v) => { if (v !== m.role) changeRoleMutation.mutate({ membership_id: m.id, role: v }); }}
                            disabled={busy}
                          >
                            <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {grantableRoles.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={() => setRevokeTarget(m)} disabled={busy}>
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />Revoke
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {!canManage && selectedOrgId && !membersLoading && members.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3">You have read-only access to this roster.</p>
          )}
        </>
      )}

      {/* Add Member */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add Member</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.user_email}
                onChange={e => setForm(p => ({ ...p, user_email: e.target.value }))}
                placeholder="person@example.com"
              />
            </div>
            <div>
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>
                  {grantableRoles.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {orgEmployees.length > 0 && (
              <div>
                <Label>Linked Employee (optional)</Label>
                <Select value={form.employee_id} onValueChange={v => setForm(p => ({ ...p, employee_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="No linked employee" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No linked employee</SelectItem>
                    {orgEmployees.map(e => <SelectItem key={e.id} value={e.id}>{e.full_name || e.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={submitGrant} disabled={grantMutation.isPending || !form.user_email.trim() || !form.role}>
                {grantMutation.isPending ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Revoke access</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revoke <span className="font-medium text-foreground">{revokeTarget?.user_email}</span>
              {revokeTarget ? <> ({ROLE_LABEL[revokeTarget.role] || revokeTarget.role})</> : null}? They will lose access to this organisation.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => revokeMutation.mutate(revokeTarget.id)} disabled={revokeMutation.isPending}>
                {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
