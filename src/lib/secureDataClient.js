/**
 * Client-side helper for calling the secureData backend gateway.
 * All org-scoped entity access MUST go through here.
 */
import { secureData as secureDataFn } from '@/functions/secureData';

export async function sdList(entity, query) {
  const res = await secureDataFn({ entity, op: 'list', query: query || {} });
  return res.data;
}

export async function sdGet(entity, id) {
  const res = await secureDataFn({ entity, op: 'get', id });
  return res.data;
}

export async function sdCreate(entity, data) {
  const res = await secureDataFn({ entity, op: 'create', data });
  return res.data;
}

export async function sdUpdate(entity, id, data) {
  const res = await secureDataFn({ entity, op: 'update', id, data });
  return res.data;
}

export async function sdDelete(entity, id) {
  const res = await secureDataFn({ entity, op: 'delete', id });
  return res.data;
}