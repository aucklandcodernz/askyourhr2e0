import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Shared scope-derivation logic (inlined — no local imports between functions).
 * Identity comes ONLY from base44.auth.me(); never from request body or params.
 */
async function getCallerScope(base44) {
    const caller = await base44.auth.me();
    if (!caller) throw new Error('Unauthenticated');

    if (caller.role === 'admin') {
        return { scope_level: 'platform', role: 'owner', organization_ids: 'ALL', memberships: [] };
    }

    const memberships = await base44.asServiceRole.entities.Membership.filter({
        user_email: caller.email,
        status: 'active'
    });

    if (!memberships || memberships.length === 0) {
        return { scope_level: 'org', organization_ids: [], memberships: [] };
    }

    const agencyAdminMembership = memberships.find(m => m.role === 'agency_admin');

    if (agencyAdminMembership) {
        const orgs = await base44.asServiceRole.entities.Organization.filter({
            id: agencyAdminMembership.organization_id,
            type: 'agency'
        });

        if (orgs && orgs.length > 0) {
            const agencyId = agencyAdminMembership.organization_id;

            const allAssignments = await base44.asServiceRole.entities.AgencyAssignment.filter({
                agency_id: agencyId,
                status: 'active'
            });

            const reachableAssignments = (allAssignments || []).filter(a =>
                !a.user_email || a.user_email === caller.email
            );

            const uniqueOrgIds = [...new Set([agencyId, ...reachableAssignments.map(a => a.organization_id)])];

            return {
                scope_level: 'agency',
                role: 'agency_admin',
                agency_id: agencyId,
                organization_ids: uniqueOrgIds,
                memberships
            };
        }
    }

    return {
        scope_level: 'org',
        organization_ids: memberships.map(m => m.organization_id),
        memberships: memberships.map(m => ({
            organization_id: m.organization_id,
            role: m.role,
            employee_id: m.employee_id || null
        }))
    };
}

// ============================================================================
// manageAccess — the ONE privileged, scoped path for provisioning memberships.
// ----------------------------------------------------------------------------
// The identity entities (Membership / AgencyAssignment / Organization) are
// admin-only RLS AND blocked by the secureData gateway, so only the platform
// owner can write them directly. This function lets agency/org admins grant,
// change, and revoke memberships WITHIN their scope — the operation the data
// gateway deliberately refuses.
//
// Invariants:
//   - Identity comes ONLY from base44.auth.me() (via getCallerScope). The
//     request body NEVER supplies the actor's role / organization_id / email.
//   - All writes go through base44.asServiceRole, and ONLY after the policy
//     check passes. FAIL-CLOSED: anything not explicitly allowed -> 403.
//   - The `User` entity is never touched; `owner` is never grantable.
//   - organization_id on every write is forced to a value inside the caller's
//     manageable scope; any out-of-scope target -> 403.
// ============================================================================

// Roles a grantor may assign (only within a manageable org). 'owner' is NEVER grantable.
const GRANTABLE = {
    owner:         ['agency_admin', 'org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'],
    agency_admin:  ['org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'], // NOT agency_admin
    org_admin:     ['org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'], // may mint co-admins
    hr_manager:    ['employee'],                                                            // onboarding only
    payroll_admin: [],
    team_leader:   [],
    employee:      [],
};

// Recognised Membership.role values (used to distinguish bad input (400) from
// a recognised-but-forbidden role (403)). 'owner' is recognised but never grantable.
const VALID_ROLES = new Set([
    'owner', 'agency_admin', 'org_admin', 'hr_manager', 'payroll_admin', 'team_leader', 'employee'
]);

// Trim + lowercase the email. Memberships are keyed by user_email, so grants are
// BY EMAIL — the person need not have an account yet.
function normEmail(e) {
    return (typeof e === 'string') ? e.trim().toLowerCase() : '';
}

function isValidEmail(e) {
    return typeof e === 'string' && /^[^\s@]+@[^\s@]+$/.test(e);
}

// The caller's Membership.role in a single org (org-scope callers only).
// platform/agency are mapped to their grantor role in grantorFor, not here.
function roleInOrg(scope, orgId) {
    const m = (scope.memberships || []).find(x => x.organization_id === orgId);
    return m ? m.role : null;
}

// May the caller manage (provision into) this org at all?
//   platform -> every org; agency/org -> only ids in scope.organization_ids.
function canManageOrg(scope, orgId) {
    if (scope.scope_level === 'platform') return true;
    return Array.isArray(scope.organization_ids) && scope.organization_ids.includes(orgId);
}

// The grantor role used to index GRANTABLE for a given target org.
//   platform -> 'owner'; agency -> 'agency_admin'; org -> the caller's role there.
function grantorFor(scope, orgId) {
    if (scope.scope_level === 'platform') return 'owner';
    if (scope.scope_level === 'agency') return 'agency_admin';
    return roleInOrg(scope, orgId);
}

// True if, excluding `excludeMembershipId`, no active org_admin remains in the org.
async function isLastActiveOrgAdmin(base44, orgId, excludeMembershipId) {
    const admins = await base44.asServiceRole.entities.Membership.filter({
        organization_id: orgId,
        role: 'org_admin',
        status: 'active'
    });
    const remaining = (admins || []).filter(m => m.id !== excludeMembershipId);
    return remaining.length === 0;
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    // Identity + authority from server auth ONLY — never from the request body.
    let scope;
    try {
        scope = await getCallerScope(base44);
    } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // actor_email for the audit trail comes from auth.me(), never the body.
    let actorEmail;
    try {
        const me = await base44.auth.me();
        actorEmail = me && me.email ? me.email : null;
    } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!actorEmail) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    body = body || {};
    const op = body.op;

    // ---- listMembers { organization_id } -----------------------------------
    if (op === 'listMembers') {
        const organization_id = body.organization_id;
        if (!organization_id) {
            return Response.json({ error: 'organization_id is required' }, { status: 400 });
        }
        if (!canManageOrg(scope, organization_id)) {
            return Response.json({ error: 'Forbidden: organization is not within your manageable scope' }, { status: 403 });
        }
        const members = await base44.asServiceRole.entities.Membership.filter({ organization_id });
        const visible = (members || [])
            .filter(m => m.status === 'active' || m.status === 'suspended')
            .map(m => ({
                user_email: m.user_email,
                role: m.role,
                status: m.status,
                employee_id: m.employee_id || null,
                organization_id: m.organization_id,
                id: m.id
            }));
        return Response.json(visible);
    }

    // ---- grantMembership { user_email, organization_id, role, employee_id? } -
    if (op === 'grantMembership') {
        const organization_id = body.organization_id;
        if (!organization_id) {
            return Response.json({ error: 'organization_id is required' }, { status: 400 });
        }
        // Tenant boundary: must be a manageable org (platform -> any).
        if (!canManageOrg(scope, organization_id)) {
            return Response.json({ error: 'Forbidden: organization is not within your manageable scope' }, { status: 403 });
        }
        const grantor = grantorFor(scope, organization_id);
        const grantable = GRANTABLE[grantor];
        if (!grantable) {
            return Response.json({ error: 'Forbidden' }, { status: 403 }); // unknown grantor -> fail-closed
        }
        // Input validation (400) for role + email.
        const role = body.role;
        if (!role || !VALID_ROLES.has(role)) {
            return Response.json({ error: 'A valid role is required' }, { status: 400 });
        }
        const email = normEmail(body.user_email);
        if (!isValidEmail(email)) {
            return Response.json({ error: 'A valid user_email is required' }, { status: 400 });
        }
        // Authorization (403): may this grantor assign this role? ('owner' never appears here.)
        if (!grantable.includes(role)) {
            return Response.json({ error: 'Forbidden: you may not grant this role' }, { status: 403 });
        }
        // Conflict (409): an active membership already exists for (email, org).
        const existingActive = await base44.asServiceRole.entities.Membership.filter({
            user_email: email,
            organization_id,
            status: 'active'
        });
        if (existingActive && existingActive.length > 0) {
            return Response.json({ error: 'An active membership already exists for this user in this organization; use changeRole' }, { status: 409 });
        }
        // Server-forced organization_id; optional employee_id must belong to THIS org.
        const newMembership = { user_email: email, organization_id, role, status: 'active' };
        if (body.employee_id) {
            const emps = await base44.asServiceRole.entities.Employee.filter({ id: body.employee_id });
            const emp = emps && emps[0];
            if (!emp || emp.organization_id !== organization_id) {
                return Response.json({ error: 'employee_id does not belong to this organization' }, { status: 400 });
            }
            newMembership.employee_id = body.employee_id;
        }
        const created = await base44.asServiceRole.entities.Membership.create(newMembership);
        await base44.asServiceRole.entities.AccessAuditLog.create({
            actor_email: actorEmail,
            action: 'grant',
            target_email: email,
            organization_id,
            new_role: role,
            note: `Granted ${role}`
        });
        return Response.json(created);
    }

    // ---- changeRole { membership_id, role } --------------------------------
    if (op === 'changeRole') {
        const membership_id = body.membership_id;
        if (!membership_id) {
            return Response.json({ error: 'membership_id is required' }, { status: 400 });
        }
        const newRole = body.role;
        if (!newRole || !VALID_ROLES.has(newRole)) {
            return Response.json({ error: 'A valid role is required' }, { status: 400 });
        }
        const rows = await base44.asServiceRole.entities.Membership.filter({ id: membership_id });
        const membership = rows && rows[0];
        if (!membership) {
            return Response.json({ error: 'Membership not found' }, { status: 404 });
        }
        const organization_id = membership.organization_id;
        if (!canManageOrg(scope, organization_id)) {
            return Response.json({ error: 'Forbidden: organization is not within your manageable scope' }, { status: 403 });
        }
        const grantor = grantorFor(scope, organization_id);
        const grantable = GRANTABLE[grantor];
        if (!grantable) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        // Must be allowed to touch the CURRENT role AND to assign the NEW role.
        if (!grantable.includes(membership.role) || !grantable.includes(newRole)) {
            return Response.json({ error: 'Forbidden: you may not change this membership to that role' }, { status: 403 });
        }
        // Lockout guard: do not demote the last active org_admin of an org.
        if (membership.status === 'active' && membership.role === 'org_admin' && newRole !== 'org_admin') {
            if (await isLastActiveOrgAdmin(base44, organization_id, membership.id)) {
                return Response.json({ error: 'Cannot change the last active org_admin of this organization' }, { status: 409 });
            }
        }
        const oldRole = membership.role;
        const updated = await base44.asServiceRole.entities.Membership.update(membership_id, { role: newRole });
        await base44.asServiceRole.entities.AccessAuditLog.create({
            actor_email: actorEmail,
            action: 'change_role',
            target_email: membership.user_email,
            organization_id,
            old_role: oldRole,
            new_role: newRole,
            note: `Changed role from ${oldRole} to ${newRole}`
        });
        return Response.json(updated);
    }

    // ---- revokeMembership { membership_id } --------------------------------
    if (op === 'revokeMembership') {
        const membership_id = body.membership_id;
        if (!membership_id) {
            return Response.json({ error: 'membership_id is required' }, { status: 400 });
        }
        const rows = await base44.asServiceRole.entities.Membership.filter({ id: membership_id });
        const membership = rows && rows[0];
        if (!membership) {
            return Response.json({ error: 'Membership not found' }, { status: 404 });
        }
        const organization_id = membership.organization_id;
        if (!canManageOrg(scope, organization_id)) {
            return Response.json({ error: 'Forbidden: organization is not within your manageable scope' }, { status: 403 });
        }
        const grantor = grantorFor(scope, organization_id);
        const grantable = GRANTABLE[grantor];
        if (!grantable) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (!grantable.includes(membership.role)) {
            return Response.json({ error: 'Forbidden: you may not revoke this membership' }, { status: 403 });
        }
        // Lockout guard: do not revoke the last active org_admin of an org.
        if (membership.status === 'active' && membership.role === 'org_admin') {
            if (await isLastActiveOrgAdmin(base44, organization_id, membership.id)) {
                return Response.json({ error: 'Cannot revoke the last active org_admin of this organization' }, { status: 409 });
            }
        }
        // Soft revoke: status -> 'revoked' (never hard-delete). Drops out of
        // getCallerScope (status:'active' filter) on the user's next request.
        await base44.asServiceRole.entities.Membership.update(membership_id, { status: 'revoked' });
        await base44.asServiceRole.entities.AccessAuditLog.create({
            actor_email: actorEmail,
            action: 'revoke',
            target_email: membership.user_email,
            organization_id,
            old_role: membership.role,
            note: `Revoked ${membership.role}`
        });
        return Response.json({ success: true });
    }

    return Response.json({ error: `Unknown op: '${op}'` }, { status: 400 });
});
