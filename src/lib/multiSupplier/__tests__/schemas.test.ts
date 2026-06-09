import { describe, it, expect } from 'vitest';
import {
  supplierSchema, systemArchetypeSchema, systemInstanceSchema,
  trustTierSchema, readinessStatusSchema, archetypeFamilySchema,
} from '../schemas';

describe('multiSupplier schemas', () => {
  const now = new Date().toISOString();
  const u = '11111111-1111-4111-8111-111111111111';

  it('parses a valid supplier row', () => {
    const ok = supplierSchema.safeParse({
      id: u, slug: 'glass-outlet', name: 'Glass Outlet',
      trustTier: 'platform', status: 'active', createdAt: now, updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });

  it('rejects an invalid trust_tier', () => {
    expect(trustTierSchema.safeParse('founder').success).toBe(false);
  });

  it('rejects an invalid readiness_status', () => {
    expect(readinessStatusSchema.safeParse('shipping').success).toBe(false);
  });

  it('parses each archetype family', () => {
    const families = ['fence','gate','pool-fence','balustrade','screen','enclosure','shower','other'];
    for (const f of families) expect(archetypeFamilySchema.safeParse(f).success).toBe(true);
    expect(archetypeFamilySchema.safeParse('roof').success).toBe(false);
  });

  it('parses a valid system_archetype row', () => {
    const ok = systemArchetypeSchema.safeParse({
      id: u, slug: 'slat-fence', name: 'Slat Fence', family: 'fence',
      geometryModule: 'fence_runs_v1', variableSchema: {},
      ruleTemplateIds: ['slat_counting_v1'], status: 'active',
      createdAt: now, updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });

  it('parses a valid system_instance row', () => {
    const ok = systemInstanceSchema.safeParse({
      id: u, supplierId: u, archetypeId: u, slug: 'qshs',
      name: 'QuickScreen Horizontal Slat', status: 'active',
      readinessStatus: 'approved', trustTier: 'platform', visibility: 'public',
      createdAt: now, updatedAt: now,
    });
    expect(ok.success).toBe(true);
  });
});