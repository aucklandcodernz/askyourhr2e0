/**
 * Shared scope-derivation helper.
 * MUST be called with an already-initialised base44 client (createClientFromRequest).
 * Identity comes ONLY from base44.auth.me() — never from request body or params.
 */
export async function getCallerScope(base44) {
    const caller = await base44.auth.me();
    if (!caller) {
        throw new Error('Unauthenticated');
    }

    // Platform owner: built-in app role === 'admin'
    if (caller.role === 'admin') {
        return {
            scope_level: 'platform',
            role: 'owner',
            organization_ids: 'ALL',
            memberships: []
        };
    }

    // Load active memberships via service role (independent of RLS)
    const memberships = await base44.asServiceRole.entities.Membership.filter({
        user_email: caller.email,
        status: 'active'
    });

    if (!memberships || memberships.length === 0) {
        return {
            scope_level: 'org',
            organization_ids: [],
            memberships: []
        };
    }

    // Check for agency_admin whose org is of type "agency"
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

            const reachableOrgIds = [
                agencyId,
                ...reachableAssignments.map(a => a.organization_id)
            ];

            const uniqueOrgIds = [...new Set(reachableOrgIds)];

            return {
                scope_level: 'agency',
                role: 'agency_admin',
                agency_id: agencyId,
                organization_ids: uniqueOrgIds,
                memberships
            };
        }
    }

    // Ordinary org roles
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