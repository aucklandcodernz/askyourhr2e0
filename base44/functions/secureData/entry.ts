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

// Organization is read-only through this gateway; write ops are always rejected
const ORG_READ_ONLY = new Set(['Organization']);

const EXPLICITLY_BLOCKED = new Set(['User', 'Membership', 'AgencyAssignment']);

function isInScope(scope, orgId) {
    if (scope.scope_level === 'platform') return true;
    return Array.isArray(scope.organization_ids) && scope.organization_ids.includes(orgId);
}

// ============================================================================
// WITHIN-ORG RBAC POLICY  — fail-closed authorization + field whitelisting
// ----------------------------------------------------------------------------
// This is the OUTER tenant boundary's inner companion. Tenant isolation (which
// orgs you can touch) is handled by isInScope above and entity RLS. THIS block
// governs, WITHIN a reachable org, *which role may do what to which fields*.
//
// Authority = the per-org `Membership.role` carried in `scope.memberships`.
// NEVER `User.role`/`caller.role` (vestigial) for within-org authz.
//   - scope_level === 'platform' -> bypasses this layer entirely (unchanged).
//   - scope_level === 'agency'   -> treated as `org_admin` for every reachable org.
// Everything here runs AFTER isInScope passes and BEFORE the asServiceRole
// store call. Fail-closed: if nothing explicitly grants it, it is denied (403).
//
// >>> Edit the four constants below (CAPS / EMPLOYEE_FIELDS / EMPLOYEE_WRITERS /
//     SENSITIVE_READ) to change policy; the helpers/handlers stay generic. <<<
// ============================================================================

// CAPS[entity][role] = { read?, create?, update?, delete? }, value 'own' | 'org'
// (absent value = denied). 'own' grants only on records the caller owns.
function ROSTER_LIKE() { return {
    employee:{read:'org'}, team_leader:{read:'org',create:'org',update:'org',delete:'org'},
    hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
};}
const CAPS = {
    Employee: {
        employee:{read:'own',update:'own'}, team_leader:{read:'org'},
        hr_manager:{read:'org',create:'org',update:'org'},
        payroll_admin:{read:'org',update:'org'},
        org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    LeaveRequest: {
        employee:{read:'own',create:'own',update:'own'}, team_leader:{read:'org',update:'org'},
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, payroll_admin:{read:'org'},
        org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    Timesheet: {
        employee:{read:'own',create:'own',update:'own'}, team_leader:{read:'org',update:'org'},
        hr_manager:{read:'org'}, payroll_admin:{read:'org',create:'org',update:'org',delete:'org'},
        org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    PerformanceReview: {
        employee:{read:'own'}, team_leader:{read:'org',create:'org',update:'org'},
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    PerformanceGoal: {
        employee:{read:'own',update:'own'}, team_leader:{read:'org',create:'org',update:'org'},
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    DisciplinaryCase: {
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    Training: {
        employee:{read:'own',update:'own'}, team_leader:{read:'org'},
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    OnboardingTask: {
        employee:{read:'own',update:'own'}, team_leader:{read:'org',create:'org',update:'org'},
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    Incident: {
        employee:{create:'org'}, team_leader:{read:'org',create:'org',update:'org'},
        hr_manager:{read:'org',create:'org',update:'org',delete:'org'}, org_admin:{read:'org',create:'org',update:'org',delete:'org'},
    },
    Roster:ROSTER_LIKE(), RiskRegister:ROSTER_LIKE(), HazardRegister:ROSTER_LIKE(), Meeting:ROSTER_LIKE(), SOPDocument:ROSTER_LIKE(),
};

// Employee field write-whitelist (allow-list, grouped into classes).
const EMPLOYEE_FIELDS = {
    contact:   ['phone','address','emergency_contact_name','emergency_contact_phone','emergency_contact_relationship','photo_url'],
    financial: ['salary','hourly_rate','bank_account_name','bank_account_number','ird_number','tax_code','kiwisaver_rate','pay_frequency'],
    employment:['position','department','employment_type','start_date','end_date','status','manager_id','visa_type','visa_expiry','visa_document_url','documents','certifications'],
    core:      ['first_name','last_name','email','date_of_birth','organization_id'], // organization_id settable only at create (scope-checked), never via update
    structural:['user_id'],
};
const EMPLOYEE_WRITERS = {
    employee:['contact'], hr_manager:['contact','employment','core'],
    payroll_admin:['financial'], org_admin:['contact','employment','core','financial','structural'],
};
// On UPDATE: 'organization_id' is stripped from every writable set (immutable via gateway).
// 'user_id' is only ever writable by org_admin (it is in the 'structural' class, which
// only org_admin holds).

// Read masking (get/list, Employee only). Sensitive groups stripped per role.
const SENSITIVE_READ = { Employee: {
    financial:['salary','hourly_rate','bank_account_name','bank_account_number','ird_number','tax_code','kiwisaver_rate','pay_frequency'],
    dob:['date_of_birth'],
}};

// ---------------------------------------------------------------------------
// Supporting tables + helpers (generic; not the editable policy surface above).
// ---------------------------------------------------------------------------

// Ownership: which field links a record to the caller's Employee id.
const OWN_BY_EMPLOYEE_ID = new Set(['LeaveRequest','Timesheet','PerformanceReview','PerformanceGoal','Training','OnboardingTask']);

// Employee self-update (cap 'own') on these progress-style entities is limited to
// obvious progress/status fields; employee_id / organization_id / parent-definition
// fields are denied (read from each entity's schema; when unsure, deny).
const PROGRESS_FIELDS = {
    PerformanceGoal: ['progress','status'],
    Training:        ['status','completed_date'],
    OnboardingTask:  ['status','completed_date'],
};

// Resolve the caller's effective role for a single org. platform/agency are
// mapped to their equivalents; org callers use their membership role verbatim.
function roleInOrg(scope, orgId) {
    if (scope.scope_level === 'platform') return 'owner';
    if (scope.scope_level === 'agency') return 'org_admin';
    const m = (scope.memberships || []).find(x => x.organization_id === orgId);
    return m ? m.role : null;
}

function callerEmployeeId(scope, orgId) {
    const m = (scope.memberships || []).find(x => x.organization_id === orgId);
    return (m && m.employee_id) ? m.employee_id : null;
}

function isOwn(entity, record, empId) {
    if (!empId || !record) return false;
    if (entity === 'Employee') return record.id === empId;
    if (OWN_BY_EMPLOYEE_ID.has(entity)) return record.employee_id === empId;
    return false;
}

function readCapFor(entity, role) {
    const caps = CAPS[entity];
    if (!caps || !caps[role]) return undefined;
    return caps[role].read; // 'own' | 'org' | undefined
}

// Fail-closed capability check. `role` is the resolved per-org role.
// platform never reaches here (bypassed in handlers); unknown entity/role -> deny.
function can(entity, op, role, own) {
    const capKey = (op === 'get' || op === 'list') ? 'read' : op;
    const caps = CAPS[entity];
    if (!caps) return false;
    const roleCaps = caps[role];
    if (!roleCaps) return false;
    const cap = roleCaps[capKey];
    if (cap === 'org') return true;
    if (cap === 'own') return own === true;
    return false;
}

// Read masking on a shallow copy — never mutates the stored record.
function maskRead(entity, role, own, record) {
    const sens = SENSITIVE_READ[entity];
    if (!sens || !record || own || role === 'owner') return record;
    const copy = Object.assign({}, record);
    const seesFinancial = role === 'payroll_admin' || role === 'org_admin';
    const seesDob = role === 'hr_manager' || role === 'payroll_admin' || role === 'org_admin';
    if (!seesFinancial) for (const f of (sens.financial || [])) delete copy[f];
    if (!seesDob) for (const f of (sens.dob || [])) delete copy[f];
    return copy;
}

// Allow-list field filter. Always returns a NEW object of permitted keys only;
// the raw request body is never forwarded to store.create/store.update.
function pickWritable(entity, role, own, data, isUpdate) {
    const out = {};
    const src = data || {};
    if (entity === 'Employee') {
        const allowed = new Set();
        for (const cls of (EMPLOYEE_WRITERS[role] || [])) {
            for (const f of (EMPLOYEE_FIELDS[cls] || [])) allowed.add(f);
        }
        allowed.delete('organization_id'); // create handler re-attaches the scoped org; never via update
        for (const k of Object.keys(src)) if (allowed.has(k)) out[k] = src[k];
        return out;
    }
    // Non-Employee: progress subset for an employee's own update, else all fields.
    let allowed = null; // null => all keys except organization_id / id
    if (role === 'employee' && own && isUpdate && PROGRESS_FIELDS[entity]) {
        allowed = new Set(PROGRESS_FIELDS[entity]);
    }
    for (const k of Object.keys(src)) {
        if (k === 'organization_id' || k === 'id') continue;
        if (allowed && !allowed.has(k)) continue;
        out[k] = src[k];
    }
    return out;
}

// State/value rules for create & update (LeaveRequest, Timesheet). Mutates
// `data` in place (forces defaults / drops fields) and returns null on success,
// or { error, status } on a violation. existing === null means create.
function enforceStateRules(entity, role, own, data, existing) {
    const isCreate = existing === null || existing === undefined;

    if (entity === 'LeaveRequest') {
        if (role === 'employee') {
            if (isCreate) {
                data.status = 'pending';            // employees always start at pending
                delete data.reviewer_id;
                delete data.review_comments;
            } else {
                if ('reviewer_id' in data || 'review_comments' in data) {
                    return { error: 'Employees cannot set reviewer fields on a leave request', status: 403 };
                }
                if ('status' in data && data.status !== 'cancelled' && data.status !== 'pending') {
                    return { error: 'Employees may only cancel their own leave request', status: 403 };
                }
                // Limit own-edit to reason / dates / total_days / status(=cancelled|pending).
                const allowed = new Set(['reason','start_date','end_date','total_days','status']);
                for (const k of Object.keys(data)) if (!allowed.has(k)) delete data[k];
            }
        } else { // approver: team_leader / hr_manager / org_admin (payroll_admin has no write cap)
            if ('status' in data && !['pending','approved','rejected','cancelled'].includes(data.status)) {
                return { error: 'Invalid leave request status', status: 400 };
            }
        }
        return null;
    }

    if (entity === 'Timesheet') {
        const EMPLOYEE_STATES = ['draft','submitted'];
        const ALL_STATES = ['draft','submitted','approved','rejected','locked'];
        if (role === 'employee') {
            if (isCreate) {
                if (!('status' in data) || !EMPLOYEE_STATES.includes(data.status)) data.status = 'draft';
                delete data.reviewer_id; delete data.review_date; delete data.review_comments;
            } else {
                if ('reviewer_id' in data || 'review_date' in data || 'review_comments' in data) {
                    return { error: 'Employees cannot set reviewer fields on a timesheet', status: 403 };
                }
                if ('status' in data && !EMPLOYEE_STATES.includes(data.status)) {
                    return { error: 'Employees may only set timesheet status to draft or submitted', status: 403 };
                }
                delete data.employee_id; // never reassign own record
            }
        } else { // approver: team_leader / payroll_admin / org_admin
            if ('status' in data && !ALL_STATES.includes(data.status)) {
                return { error: 'Invalid timesheet status', status: 400 };
            }
        }
        return null;
    }

    return null; // no state rules for other entities
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

    // Organization: read-only (list/get); reject write ops
    if (ORG_READ_ONLY.has(entity)) {
        if (op !== 'list' && op !== 'get') {
            return Response.json({ error: `'${op}' is not permitted for Organization through this gateway` }, { status: 403 });
        }
    } else if (!ALLOWED_ENTITIES.has(entity)) {
        return Response.json({ error: `Unknown or disallowed entity: '${entity}'` }, { status: 403 });
    }

    const validOps = ['list', 'get', 'create', 'update', 'delete'];
    if (!validOps.includes(op)) {
        return Response.json({ error: `Invalid op: '${op}'` }, { status: 400 });
    }

    // platform = full access, unchanged (the within-org RBAC layer does not apply).
    const isPlatform = scope.scope_level === 'platform';

    // Invariant 3: all DB calls via asServiceRole, AFTER scope check passes
    const store = base44.asServiceRole.entities[entity];

    if (op === 'list') {
        if (isPlatform) {
            const result = await store.filter(query || {});
            return Response.json(result);
        }
        if (entity === 'Organization') {
            // Scope Organization reads: only ids the caller can reach
            const safeQuery = Object.assign({}, query || {}, {
                id: { $in: scope.organization_ids }
            });
            const result = await store.filter(safeQuery);
            return Response.json(result);
        }
        const orgIds = scope.organization_ids || [];
        // Fully denied to this role across every reachable org -> 403
        const anyReadable = orgIds.some(o => readCapFor(entity, roleInOrg(scope, o)) !== undefined);
        if (!anyReadable) {
            return Response.json({ error: `Forbidden: no read access to '${entity}'` }, { status: 403 });
        }
        // Mandatory org filter — client query cannot widen beyond allowed orgs
        const safeQuery = Object.assign({}, query || {}, {
            organization_id: { $in: orgIds }
        });
        // If read is 'own' in every queried org, narrow the query to own records too.
        const allOwn = orgIds.length > 0 && orgIds.every(o => readCapFor(entity, roleInOrg(scope, o)) === 'own');
        if (allOwn) {
            const empIds = orgIds.map(o => callerEmployeeId(scope, o)).filter(Boolean);
            if (empIds.length === 0) return Response.json([]);
            if (entity === 'Employee') safeQuery.id = { $in: empIds };
            else safeQuery.employee_id = { $in: empIds };
        }
        const rows = (await store.filter(safeQuery)) || [];
        // Per-result authorization + masking (roles may differ per org).
        const out = [];
        for (const rec of rows) {
            const r = roleInOrg(scope, rec.organization_id);
            const empId = callerEmployeeId(scope, rec.organization_id);
            const own = isOwn(entity, rec, empId);
            if (can(entity, 'list', r, own)) out.push(maskRead(entity, r, own, rec));
        }
        return Response.json(out);
    }

    if (op === 'get') {
        if (!id) return Response.json({ error: 'id is required for get' }, { status: 400 });
        const records = await store.filter({ id });
        const record = records && records[0];
        if (!record) return Response.json({ error: 'Not found' }, { status: 404 });
        // For Organization, scope check is by its own id; for others, by organization_id field
        const scopeCheckId = entity === 'Organization' ? record.id : record.organization_id;
        if (!isInScope(scope, scopeCheckId)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        // Organization reads (and platform) are governed by scope only — no within-org RBAC.
        if (isPlatform || entity === 'Organization') return Response.json(record);
        const role = roleInOrg(scope, record.organization_id);
        const empId = callerEmployeeId(scope, record.organization_id);
        const own = isOwn(entity, record, empId);
        if (!can(entity, 'get', role, own)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        return Response.json(maskRead(entity, role, own, record));
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
        if (isPlatform) {
            const created = await store.create(data);
            return Response.json(created);
        }
        const role = roleInOrg(scope, targetOrgId);
        const empId = callerEmployeeId(scope, targetOrgId);
        const createCap = (CAPS[entity] && CAPS[entity][role]) ? CAPS[entity][role].create : undefined;
        if (!createCap) {
            return Response.json({ error: `Forbidden: cannot create '${entity}'` }, { status: 403 });
        }
        const own = createCap === 'own';
        if (own) {
            if (!empId) return Response.json({ error: 'Forbidden: no employee profile in this organization' }, { status: 403 });
            data.employee_id = empId; // own-create is always anchored to the caller
        }
        const violation = enforceStateRules(entity, role, own, data, null);
        if (violation) return Response.json({ error: violation.error }, { status: violation.status });
        const clean = pickWritable(entity, role, own, data, false);
        clean.organization_id = targetOrgId; // re-attach the scope-checked org
        const created = await store.create(clean);
        return Response.json(maskRead(entity, role, own, created));
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
        if (isPlatform) {
            const updated = await store.update(id, data);
            return Response.json(updated);
        }
        const role = roleInOrg(scope, existing.organization_id);
        const empId = callerEmployeeId(scope, existing.organization_id);
        const own = isOwn(entity, existing, empId);
        if (!can(entity, 'update', role, own)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        const clean = pickWritable(entity, role, own, data, true);
        const violation = enforceStateRules(entity, role, own, clean, existing);
        if (violation) return Response.json({ error: violation.error }, { status: violation.status });
        delete clean.organization_id; // immutable via gateway
        const updated = await store.update(id, clean);
        return Response.json(maskRead(entity, role, own, updated));
    }

    if (op === 'delete') {
        if (!id) return Response.json({ error: 'id is required for delete' }, { status: 400 });
        const records = await store.filter({ id });
        const existing = records && records[0];
        if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });
        if (!isInScope(scope, existing.organization_id)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        if (isPlatform) {
            await store.delete(id);
            return Response.json({ success: true });
        }
        const role = roleInOrg(scope, existing.organization_id);
        const empId = callerEmployeeId(scope, existing.organization_id);
        const own = isOwn(entity, existing, empId);
        if (!can(entity, 'delete', role, own)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
        await store.delete(id);
        return Response.json({ success: true });
    }
});
