import { useQuery } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { localProducts } from '../lib/localSeedData';

export interface Product {
  id: string;
  name: string;
  system_type: string;
  description: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  system_instance_id?: string | null;
  supplier_id?: string | null;
  metadata?: {
    allowedAngles?: number[];
    /** Tier A: drives pitch ladder vs freeform height input — see `parseTargetHeightUi` */
    target_height_ui?: {
      mode?: 'pitch_ladder' | 'freeform_mm';
      pitch_var_keys?: string[];
    };
    options?: {
      slatSize?: string[];
      slatGap?: string[];
      colour?: string[];
    };
  };
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      if (!isSupabaseConfigured) return localProducts;

      const { data, error } = await supabase
        .from('products')
        .select('id, name, system_type, description, image_url, active, sort_order, metadata, system_instance_id, supplier_id')
        .order('active', { ascending: false })
        .order('sort_order', { ascending: true });
      if (error) return localProducts;

      if (data && data.length > 0) {
        // Deduplicate products by system_type, prioritizing the one with non-null system_instance_id
        const bySystem = new Map<string, Product>();
        for (const p of data) {
          const existing = bySystem.get(p.system_type);
          if (!existing || (p.system_instance_id !== null && existing.system_instance_id === null)) {
            bySystem.set(p.system_type, p as Product);
          }
        }
        return Array.from(bySystem.values());
      }
      return localProducts;
    },
  });
}
