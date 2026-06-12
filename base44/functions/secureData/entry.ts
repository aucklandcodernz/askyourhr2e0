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

const ALLOWED_ENTITIES = new Set([
    'Employee', 'OnboardingTask', 'Timesheet', 'Incident', 'Roster',
    'RiskRegister', 'HazardRegister', 'Meeting', 'SOPDocument',
    'PerformanceGoal', 'PerformanceReview', 'DisciplinaryCase',
    'Training', 'LeaveRequest'
]);

const EXPLICITLY_BLOCKED = new Set(['User', 'Membership', 'AgencyAssignment', 'Organization']);

function isInScope(scope, orgId) {
    if (scope.scope_level === 'platform') return true;
    return Array.isArray(scope.organization_ids) && scope.organization_ids.includes(orgId);
}

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    // Invariant 1: derive scope from server auth only — never from request body
    let scope;
    try {
        scope = await getCallerScope(base44);
    } catch {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { entity, op, id, data, query } = body;

    // Invariant 2: entity allow/deny list
    if (EXPLICITLY_BLOCKED.has(entity)) {
        return Response.json({ error: `Access to '${entity}' is not permitted through this gateway` }, { status: 403 });
    }
    if (!ALLOWED_ENTITIES.has(entity)) {
        return Response.json({ error: `Unknown or disallowed entity: '${entity}'` }, { status: 403 });
    }

    const validOps = ['list', 'get', 'create', 'update', 'delete'];
    if (!validOps.includes(op)) {
        return Response.json({ error: `Invalid op: '${op}'` }, { status: 400 });
    }

    // Invariant 3: all DB calls via asServiceRole, AFTER scope check passes
    const store = base44.asServiceRole.entities[entity];

    if (op === 'list') {
        let result;
        if (scope.scope_level === 'platform') {
            result = await store.filter(query || {});
        } else {
            // Mandatory org filter — client query cannot widen beyond allowed orgs
            const safeQuery = Object.assign({}, query || {}, {
                organization_id: { $in: scope.organization_ids }
            });
            result = await store.filter(safeQuery);
        }
        return Response.json(result);
    }

    if (op === 'get') {
        if (!id) return Response.json({ error: 'id is required for get' }, { status: 400 });
        const records = await store.filter({ id });
        const record = records && records[0];
        if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
        if (!isInScope(scope, record.organization_id)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        return Response.json(record);
    }

    if (op === 'create') {
        if (!data) return Response.json({ error: 'data is required for create' }, { status: 400 });
        const targetOrgId = data.organization_id;
        if (!targetOrgId) {
            return Response.json({ error: 'organization_id is required on the record' }, { status: 400 });
        }
        if (!isInScope(scope, targetOrgId)) {
            return Response.json({ error: 'Forbidden: organization_id is outside your scope' }, { status: 403 });
        }
        const created = await store.create(data);
        return Response.json(created);
    }

    if (op === 'update') {
        if (!id) return Response.json({ error: 'id is required for update' }, { status: 400 });
        if (!data) return Response.json({ error: 'data is required for update' }, { status: 400 });
        const records = await store.filter({ id });
        const existing = records && records[0];
        if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
        if (!isInScope(scope, existing.organization_id)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (data.organization_id && !isInScope(scope, data.organization_id)) {
            return Response.json({ error: 'Forbidden: cannot move record to an organization outside your scope' }, { status: 403 });
        }
        const updated = await store.update(id, data);
        return Response.json(updated);
    }

    if (op === 'delete') {
        if (!id) return Response.json({ error: 'id is required for delete' }, { status: 400 });
        const records = await store.filter({ id });
        const existing = records && records[0];
        if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
        if (!isInScope(scope, existing.organization_id)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        await store.delete(id);
        return Response.json({ success: true });
    }
});