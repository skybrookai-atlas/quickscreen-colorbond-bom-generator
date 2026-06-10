import { supabase } from '../supabase';
import type { Supplier, SystemInstance, EntityStatus } from '../../types/multiSupplier';

export async function upsertSupplier(supplier: Omit<Supplier, 'createdAt' | 'updatedAt'>): Promise<Supplier> {
  const row = supplierToRow(supplier);
  const { data, error } = await supabase
    .from('suppliers')
    .upsert(row)
    .select('*')
    .single();

  if (error) throw error;
  return rowToSupplier(data);
}

export async function deleteSupplier(id: string): Promise<void> {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function upsertSystemInstance(instance: Omit<SystemInstance, 'createdAt' | 'updatedAt'>): Promise<SystemInstance> {
  const row = systemInstanceToRow(instance);
  const { data, error } = await supabase
    .from('system_instances')
    .upsert(row)
    .select('*')
    .single();

  if (error) throw error;
  return rowToSystemInstance(data);
}

export async function deleteSystemInstance(id: string): Promise<void> {
  const { error } = await supabase
    .from('system_instances')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateSystemInstanceStatus(id: string, status: EntityStatus): Promise<void> {
  const { error } = await supabase
    .from('system_instances')
    .update({ status })
    .eq('id', id);

  if (error) throw error;
}

function supplierToRow(supplier: Partial<Supplier>) {
  const row: any = {};
  if (supplier.id !== undefined) row.id = supplier.id;
  if (supplier.slug !== undefined) row.slug = supplier.slug;
  if (supplier.name !== undefined) row.name = supplier.name;
  if (supplier.logoUrl !== undefined) row.logo_url = supplier.logoUrl;
  if (supplier.brandColour !== undefined) row.brand_colour = supplier.brandColour;
  if (supplier.contactEmail !== undefined) row.contact_email = supplier.contactEmail;
  if (supplier.trustTier !== undefined) row.trust_tier = supplier.trustTier;
  if (supplier.authoredBy !== undefined) row.authored_by = supplier.authoredBy;
  if (supplier.orgId !== undefined) row.org_id = supplier.orgId;
  if (supplier.status !== undefined) row.status = supplier.status;
  if (supplier.metadata !== undefined) row.metadata = supplier.metadata;
  return row;
}

function systemInstanceToRow(instance: Partial<SystemInstance>) {
  const row: any = {};
  if (instance.id !== undefined) row.id = instance.id;
  if (instance.supplierId !== undefined) row.supplier_id = instance.supplierId;
  if (instance.archetypeId !== undefined) row.archetype_id = instance.archetypeId;
  if (instance.slug !== undefined) row.slug = instance.slug;
  if (instance.name !== undefined) row.name = instance.name;
  if (instance.description !== undefined) row.description = instance.description;
  if (instance.status !== undefined) row.status = instance.status;
  if (instance.readinessStatus !== undefined) row.readiness_status = instance.readinessStatus;
  if (instance.trustTier !== undefined) row.trust_tier = instance.trustTier;
  if (instance.visibility !== undefined) row.visibility = instance.visibility;
  if (instance.authoredBy !== undefined) row.authored_by = instance.authoredBy;
  if (instance.orgId !== undefined) row.org_id = instance.orgId;
  if (instance.approvedBy !== undefined) row.approved_by = instance.approvedBy;
  if (instance.approvedAt !== undefined) row.approved_at = instance.approvedAt;
  if (instance.readinessNotes !== undefined) row.readiness_notes = instance.readinessNotes;
  if (instance.metadata !== undefined) row.metadata = instance.metadata;
  if (instance.aiVettingStatus !== undefined) row.ai_vetting_status = instance.aiVettingStatus;
  if (instance.aiVettingNotes !== undefined) row.ai_vetting_notes = instance.aiVettingNotes;
  if (instance.isPublicLibrary !== undefined) row.is_public_library = instance.isPublicLibrary;
  if (instance.isNewProduct !== undefined) row.is_new_product = instance.isNewProduct;
  return row;
}

function rowToSupplier(row: any): Supplier {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url ?? undefined,
    brandColour: row.brand_colour ?? undefined,
    contactEmail: row.contact_email ?? undefined,
    trustTier: row.trust_tier,
    authoredBy: row.authored_by ?? undefined,
    orgId: row.org_id ?? undefined,
    status: row.status,
    metadata: row.metadata ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSystemInstance(row: any): SystemInstance {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    archetypeId: row.archetype_id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    readinessStatus: row.readiness_status,
    trustTier: row.trust_tier,
    visibility: row.visibility,
    authoredBy: row.authored_by ?? undefined,
    orgId: row.org_id ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    readinessNotes: row.readiness_notes ?? undefined,
    metadata: row.metadata ?? undefined,
    aiVettingStatus: row.ai_vetting_status ?? undefined,
    aiVettingNotes: row.ai_vetting_notes ?? undefined,
    isPublicLibrary: row.is_public_library ?? false,
    isNewProduct: row.is_new_product ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
