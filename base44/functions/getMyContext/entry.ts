import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Invariant: identity comes ONLY from server-side auth, never from request body
    const callerEmail = user.email;
    const callerAppRole = user.role;

    // Platform owner shortcut
    if (callerAppRole === 'admin') {
        return Response.json({
            scope_level: 'platform',
            role: 'owner',
            organization_ids: 'ALL',
            memberships: []
        });
    }

    // Load active memberships via service role so this is independent of RLS
    const memberships = await base44.asServiceRole.entities.Membership.filter({
        user_email: callerEmail,
        status: 'active'
    });

    if (!memberships || memberships.length === 0) {
        return Response.json({
            scope_level: 'org',
            organization_ids: [],
            memberships: []
        });
    }

    // Check for agency_admin membership whose org is of type "agency"
    const agencyAdminMembership = memberships.find(m => m.role === 'agency_admin');

    if (agencyAdminMembership) {
        // Verify the org is actually of type "agency"
        const org = await base44.asServiceRole.entities.Organization.filter({
            id: agencyAdminMembership.organization_id,
            type: 'agency'
        });

        if (org && org.length > 0) {
            const agencyId = agencyAdminMembership.organization_id;

            // Load agency assignments for this agency where status is active
            // and either user_email is empty/null OR matches caller
            const allAssignments = await base44.asServiceRole.entities.AgencyAssignment.filter({
                agency_id: agencyId,
                status: 'active'
            });

            // Filter: user_email is empty/null OR matches caller
            const reachableAssignments = (allAssignments || []).filter(a =>
                !a.user_email || a.user_email === callerEmail
            );

            const reachableOrgIds = [
                agencyId,
                ...reachableAssignments.map(a => a.organization_id)
            ];

            // Deduplicate
            const uniqueOrgIds = [...new Set(reachableOrgIds)];

            return Response.json({
                scope_level: 'agency',
                role: 'agency_admin',
                agency_id: agencyId,
                organization_ids: uniqueOrgIds,
                memberships
            });
        }
    }

    // Ordinary org roles
    const organizationIds = memberships.map(m => m.organization_id);

    return Response.json({
        scope_level: 'org',
        organization_ids: organizationIds,
        memberships: memberships.map(m => ({
            organization_id: m.organization_id,
            role: m.role,
            employee_id: m.employee_id || null
        }))
    });
});