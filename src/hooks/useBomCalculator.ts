import { useMutation } from '@tanstack/react-query';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { calculateLocalBom } from '../lib/localBomCalculator';
import type { CanonicalPayload, CanonicalRun, CanonicalSegment } from '../types/canonical.types';
import type { PricingTier } from '../types/bom.types';

function expandSectionSystemOverrides(payload: CanonicalPayload): CanonicalPayload {
  const runs: CanonicalRun[] = [];

  for (const run of payload.runs) {
    const baseSegments: CanonicalSegment[] = [];
    const overrideGroups = new Map<string, CanonicalSegment[]>();

    for (const segment of run.segments) {
      // Ensure both kind and segmentKind are set for engine compatibility
      const segWithKind: CanonicalSegment = {
        ...segment,
        kind: segment.kind ?? (segment.segmentKind === 'gate_opening' ? 'gate' : 'fence'),
        segmentKind: segment.segmentKind ?? (segment.kind === 'gate' ? 'gate_opening' : 'panel'),
        productCode: segment.productCode ?? (segment.segmentKind === 'gate_opening' ? 'QS_GATE' : run.productCode),
      };

      if (segWithKind.segmentKind === 'gate_opening') {
        baseSegments.push(segWithKind);
        continue;
      }
      const segmentProductCode = String(segWithKind.variables?.product_code ?? run.productCode);
      if (segmentProductCode === run.productCode) {
        baseSegments.push(segWithKind);
        continue;
      }
      overrideGroups.set(segmentProductCode, [
        ...(overrideGroups.get(segmentProductCode) ?? []),
        segWithKind,
      ]);
    }

    if (baseSegments.length > 0) {
      runs.push({ ...run, segments: baseSegments });
    }

    for (const [productCode, segments] of overrideGroups) {
      runs.push({
        ...run,
        runId: `${run.runId}-${productCode.toLowerCase()}`,
        productCode,
        segments: segments.map((s) => ({ ...s, productCode })),
        corners: [],
      });
    }
  }

  // Always return mapped/changed payload if runs were processed or kind was normalized
  return { ...payload, runs };
}

export function useBomCalculator() {
  return useMutation({
    mutationFn: async ({
      payload,
      pricingTier,
      supplierSlug,
    }: {
      payload: CanonicalPayload;
      pricingTier?: PricingTier;
      supplierSlug?: string;
    }) => {
      const tier = pricingTier ?? 'tier1';
      const calculatorPayload = expandSectionSystemOverrides(payload);
      if (!isSupabaseConfigured) {
        return calculateLocalBom(calculatorPayload, tier);
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      const invokeHeaders: Record<string, string> = {};
      if (session?.access_token) {
        invokeHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('bom-calculator', {
        body: { 
          payload: calculatorPayload, 
          pricingTier: tier, 
          supplierSlug: supplierSlug || (calculatorPayload.variables?.supplier_slug as string | undefined) || 'amazing-fencing'
        },
        headers: invokeHeaders,
      });
      if (error) return calculateLocalBom(calculatorPayload, tier);
      return data as Record<string, unknown>;
    },
  });
}
