import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getSupplierBySlug } from '../lib/multiSupplier/queries';
import { getSubdomain } from '../lib/subdomain';

function hexToRgbChannels(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r} ${g} ${b}`;
  } else if (clean.length === 6) {
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `${r} ${g} ${b}`;
  }
  return '30 64 175'; // fallback default blue
}

export function useBranding(overrideSlug?: string) {
  const { supplierSlug: urlSlug } = useParams<{ supplierSlug?: string }>();
  const subdomain = getSubdomain();
  const supplierSlug = overrideSlug || urlSlug || subdomain;

  const { data: supplier, isLoading } = useQuery({
    queryKey: ['branding', 'supplier', supplierSlug],
    queryFn: () => supplierSlug ? getSupplierBySlug(supplierSlug) : Promise.resolve(null),
    enabled: !!supplierSlug,
  });

  useEffect(() => {
    if (!supplier) return;

    const originalVars: Record<string, string> = {};
    const varsToSet: Record<string, string> = {};

    // 1. Core Brand Color conversion for Tailwind rgb(var(--brand-primary) / <alpha-value>)
    if (supplier.brandColour) {
      const rgbStr = hexToRgbChannels(supplier.brandColour);
      varsToSet['--brand-primary'] = rgbStr;
      varsToSet['--brand-accent'] = rgbStr;
    }

    // 2. Custom style variables overrides
    if (supplier.customBrandingStyles) {
      Object.entries(supplier.customBrandingStyles).forEach(([key, val]) => {
        varsToSet[key] = val;
      });
    }

    // Set variables and keep track of original values for cleanup
    Object.entries(varsToSet).forEach(([key, val]) => {
      originalVars[key] = document.documentElement.style.getPropertyValue(key);
      document.documentElement.style.setProperty(key, val);
    });

    return () => {
      // Revert style variables when supplier page is closed
      Object.entries(varsToSet).forEach(([key]) => {
        if (originalVars[key]) {
          document.documentElement.style.setProperty(key, originalVars[key]);
        } else {
          document.documentElement.style.removeProperty(key);
        }
      });
    };
  }, [supplier]);

  return {
    supplier,
    isLoading,
    isBranded: !!supplierSlug && !!supplier,
    branding: supplier ? {
      title: supplier.name,
      subtitle: (supplier.metadata?.description as string) ?? `${supplier.name} Calculator`,
      hideThemeToggle: true,
    } : undefined,
    logoUrl: supplier?.customBrandingLogo || supplier?.logoUrl,
    bannerUrl: supplier?.customBrandingBanner,
  };
}
