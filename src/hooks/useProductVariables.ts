import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getLocalVariables } from '../lib/localSeedData';
import type { SchemaField } from '../components/calculator-v3/SchemaDrivenForm';

type Scope = 'job' | 'run' | 'segment';

// Fetches product_variables rows for the given product + scope and shapes
// them into SchemaField[] that the v3 SchemaDrivenForm can render directly.
// RLS on product_variables allows authenticated SELECT (migration 012).
export function useProductVariables(systemType: string | null, scope: Scope, orgId?: string | null) {
  return useQuery<SchemaField[]>({
    queryKey: ['product-variables', systemType, scope, orgId],
    enabled: !!systemType,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!systemType) return [];
      if (!isSupabaseConfigured) return getLocalVariables(systemType, scope);

      let query = supabase
        .from('products')
        .select('id, system_instance_id')
        .eq('system_type', systemType)
        .eq('active', true);

      if (orgId) {
        query = query.eq('org_id', orgId);
      }

      const { data: products, error: prodErr } = await query;
      if (prodErr || !products || products.length === 0) return getLocalVariables(systemType, scope);

      const product = products.find((p) => p.system_instance_id !== null) || products[0];

      const { data, error } = await supabase
        .from('product_variables')
        .select('id, name, label, data_type, unit, required, default_value_json, options_json, options_group, sort_order')
        .eq('product_id', product.id)
        .eq('scope', scope)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (error) return getLocalVariables(systemType, scope);

      if (!data || data.length === 0) return getLocalVariables(systemType, scope);

      return data.map((v) => ({
        id: v.id as string,
        field_key: v.name as string,
        label: v.label as string,
        control_type:
          v.data_type === 'enum'
            ? 'select'
            : v.data_type === 'number' || v.data_type === 'integer'
              ? 'number'
              : v.data_type === 'boolean'
                ? 'toggle'
                : 'text',
        data_type: v.data_type as string,
        unit: (v.unit as string | null) ?? undefined,
        required: Boolean(v.required),
        default_value_json: v.default_value_json,
        options_json: Array.isArray(v.options_json) ? (v.options_json as unknown[]) : [],
        options_group: (v.options_group as string | null) ?? undefined,
        visible_when_json: {},
        sort_order: Number(v.sort_order ?? 0),
      }));
    },
  });
}
