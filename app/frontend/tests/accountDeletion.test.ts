// SPEC 018.2 - reglas puras de eliminacion de cuenta.
import { describe, expect, it } from 'vitest';
import {
  canDeleteAccount,
  findBlockingWorkspaces,
  assertCanDeleteAccount,
  type WorkspaceOwnership,
} from '../src/auth/accountDeletion.js';
import { AuthError, AuthErrorCode } from '../src/auth/authErrors.js';

const personal: WorkspaceOwnership = {
  id: 'w-personal',
  type: 'personal',
  ownerIds: ['u1'],
  adminIds: [],
};

describe('SPEC 018.2 - eliminacion de cuenta', () => {
  it('permite borrar si solo tiene workspace personal', () => {
    expect(canDeleteAccount('u1', [personal])).toBe(true);
  });

  it('bloquea si es unico owner de una organizacion', () => {
    const org: WorkspaceOwnership = {
      id: 'w-org',
      type: 'organization',
      ownerIds: ['u1'],
      adminIds: [],
    };
    expect(canDeleteAccount('u1', [org])).toBe(false);
    expect(findBlockingWorkspaces('u1', [org]).map((w) => w.id)).toEqual(['w-org']);
  });

  it('permite borrar si la organizacion tiene otro owner/admin', () => {
    const org: WorkspaceOwnership = {
      id: 'w-org',
      type: 'organization',
      ownerIds: ['u1', 'u2'],
      adminIds: [],
    };
    expect(canDeleteAccount('u1', [org])).toBe(true);
    const orgAdmin: WorkspaceOwnership = {
      id: 'w-org2',
      type: 'organization',
      ownerIds: ['u1'],
      adminIds: ['u3'],
    };
    expect(canDeleteAccount('u1', [orgAdmin])).toBe(true);
  });

  it('assert lanza si no hay confirmacion', () => {
    try {
      assertCanDeleteAccount({ userId: 'u1', confirmed: false, workspaces: [personal] });
      throw new Error('esperaba AuthError');
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).codes).toContain(AuthErrorCode.ACCOUNT_DELETE_CONFIRMATION_REQUIRED);
    }
  });

  it('assert lanza si bloquea por unico owner', () => {
    const org: WorkspaceOwnership = { id: 'w', type: 'organization', ownerIds: ['u1'], adminIds: [] };
    try {
      assertCanDeleteAccount({ userId: 'u1', confirmed: true, workspaces: [org] });
      throw new Error('esperaba AuthError');
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).codes).toContain(
        AuthErrorCode.ACCOUNT_DELETE_WORKSPACE_OWNER_BLOCKED,
      );
    }
  });
});
