/** Shared client helpers for the /app screens. */
import {
  clearProfile,
  getProfile,
  takePendingScan,
  type Profile,
} from './store.ts';

export function flash(kind: 'ok' | 'error', text: string): void {
  let el = document.getElementById('app-flash');
  if (!el) {
    el = document.createElement('p');
    el.id = 'app-flash';
    el.className = 'flash';
    el.setAttribute('role', 'status');
    document.querySelector('.app main')?.prepend(el);
  }
  el.dataset.kind = kind;
  el.textContent = text;
  el.scrollIntoView({ block: 'nearest' });
}

export function requireProfile(role?: Profile['role']): Profile | null {
  const p = getProfile();
  if (!p) {
    location.href = '/app/';
    return null;
  }
  if (role && p.role !== role) {
    location.href = p.role === 'apicultor' ? '/app/apicultor' : '/app/envasadora';
    return null;
  }
  return p;
}

export function signOut(): void {
  clearProfile();
  location.href = '/app/';
}

/** After entering, resume a scan that happened before access, if any. */
export function resumePendingScan(): void {
  const pending = takePendingScan();
  if (pending) location.href = `/app/lote?id=${encodeURIComponent(pending)}`;
}

export function field<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el campo #${id}`);
  return el as T;
}

export function val(id: string): string {
  const el = field<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id);
  return el.value.trim();
}

export function num(id: string): number {
  return Number(val(id).replace(',', '.'));
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
