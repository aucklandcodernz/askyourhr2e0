/**
 * Client-side helper for calling the manageAccess backend function.
 * ALL membership operations MUST go through here — never call
 * base44.entities.Membership.* from the UI, and never read Membership
 * through secureData (the gateway blocks it). manageAccess is the real,
 * fail-closed authority; this client just normalises its responses.
 */
import { manageAccess as manageAccessFn } from '@/functions/manageAccess';

async function call(payload) {
  let res;
  try {
    res = await manageAccessFn(payload);
  } catch (err) {
    // The SDK rejected on a non-2xx response. Dig the backend {error} out of
    // whichever error shape arrived (AxiosError -> err.response.data;
    // Base44Error -> err.data) and rethrow a clean Error carrying it.
    const data = err?.response?.data ?? err?.data;
    const message = (data && typeof data === 'object' && data.error) ? data.error : err?.message;
    const e = new Error(message || 'Request failed');
    e.status = err?.response?.status ?? err?.status;
    throw e;
  }
  // The SDK resolved with the response (non-2xx body surfaced here).
  const body = res?.data;
  if (body && typeof body === 'object' && body.error) {
    const e = new Error(body.error);
    e.status = res?.status;
    throw e;
  }
  return body;
}

export const listMembers     = (organization_id)     => call({ op: 'listMembers', organization_id });
export const grantMembership = (payload)              => call({ op: 'grantMembership', ...payload }); // {user_email, organization_id, role, employee_id?}
export const changeRole      = (membership_id, role)  => call({ op: 'changeRole', membership_id, role });
export const revokeMembership= (membership_id)        => call({ op: 'revokeMembership', membership_id });
