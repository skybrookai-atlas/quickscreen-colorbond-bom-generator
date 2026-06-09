import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useProfile } from '../../context/ProfileContext';
import type { Supplier } from '../../types/multiSupplier';
import { Button } from '../ui/Button';

const supplierFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase alphanumeric characters and hyphens'),
  logoUrl: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  brandColour: z.string().optional(),
  contactEmail: z.string().email('Must be a valid email').or(z.literal('')).optional(),
  trustTier: z.enum(['platform', 'verified', 'community', 'user']),
  status: z.enum(['active', 'hidden', 'draft', 'discontinued']),
  metadataString: z.string().refine((val) => {
    if (!val.trim()) return true;
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, 'Must be valid JSON'),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

interface SupplierFormProps {
  initialData?: Partial<Supplier>;
  onSubmit: (data: Omit<Supplier, 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function SupplierForm({ initialData, onSubmit, onCancel, isLoading }: SupplierFormProps) {
  const { isAdmin } = useProfile();
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSlugManuallyEdited = useRef(false);

  const isEditMode = !!initialData?.id;

  const defaultValues: SupplierFormData = {
    name: initialData?.name ?? '',
    slug: initialData?.slug ?? '',
    logoUrl: initialData?.logoUrl ?? '',
    brandColour: initialData?.brandColour ?? '',
    contactEmail: initialData?.contactEmail ?? '',
    trustTier: initialData?.trustTier ?? 'user',
    status: initialData?.status ?? 'draft',
    metadataString: initialData?.metadata ? JSON.stringify(initialData.metadata, null, 2) : '',
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues,
  });

  const nameValue = watch('name');
  const trustTierValue = watch('trustTier');

  // Auto-slugify name when creating a new supplier (only if slug was not manually touched)
  useEffect(() => {
    if (!isEditMode && !isSlugManuallyEdited.current) {
      const generatedSlug = (nameValue || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setValue('slug', generatedSlug, { shouldValidate: true });
    }
  }, [nameValue, isEditMode, setValue]);

  const onFormSubmit = async (data: SupplierFormData) => {
    try {
      setSubmitError(null);
      let parsedMetadata: Record<string, unknown> | undefined;
      if (data.metadataString.trim()) {
        parsedMetadata = JSON.parse(data.metadataString);
      }

      await onSubmit({
        id: initialData?.id || crypto.randomUUID(),
        name: data.name,
        slug: data.slug,
        logoUrl: data.logoUrl || undefined,
        brandColour: data.brandColour || undefined,
        contactEmail: data.contactEmail || undefined,
        trustTier: data.trustTier,
        status: data.status,
        metadata: parsedMetadata,
        authoredBy: initialData?.authoredBy,
        orgId: initialData?.orgId,
      });
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred while saving the supplier.');
    }
  };

  // Restrict trust tier options if not admin (defaulting others to user)
  const trustTiers = isAdmin
    ? [
        { value: 'platform', label: 'Platform' },
        { value: 'verified', label: 'Verified' },
        { value: 'community', label: 'Community' },
        { value: 'user', label: 'User' },
      ]
    : [
        { value: 'community', label: 'Community' },
        { value: 'user', label: 'User' },
      ];

  const statuses = [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'hidden', label: 'Hidden' },
    { value: 'discontinued', label: 'Discontinued' },
  ];

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 max-w-2xl bg-brand-card border border-brand-border p-6 rounded-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Supplier Name <span className="text-brand-danger">*</span>
          </label>
          <input
            {...register('name')}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm"
            placeholder="e.g. Glass Outlet"
            data-testid="supplier-name"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-brand-danger">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Slug <span className="text-brand-danger">*</span>
          </label>
          <input
            {...register('slug', {
              onChange: () => {
                isSlugManuallyEdited.current = true;
              },
            })}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm disabled:opacity-60"
            placeholder="e.g. glass-outlet"
            disabled={isEditMode}
            data-testid="supplier-slug"
          />
          {errors.slug && (
            <p className="mt-1 text-xs text-brand-danger">{errors.slug.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Logo URL
          </label>
          <input
            {...register('logoUrl')}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm"
            placeholder="https://example.com/logo.png"
            data-testid="supplier-logo-url"
          />
          {errors.logoUrl && (
            <p className="mt-1 text-xs text-brand-danger">{errors.logoUrl.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Brand Colour
          </label>
          <input
            {...register('brandColour')}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm"
            placeholder="e.g. #005A9C"
            data-testid="supplier-brand-colour"
          />
          {errors.brandColour && (
            <p className="mt-1 text-xs text-brand-danger">{errors.brandColour.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Contact Email
          </label>
          <input
            {...register('contactEmail')}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm"
            placeholder="info@glassoutlet.com.au"
            data-testid="supplier-email"
          />
          {errors.contactEmail && (
            <p className="mt-1 text-xs text-brand-danger">{errors.contactEmail.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Trust Tier <span className="text-brand-danger">*</span>
          </label>
          <select
            {...register('trustTier')}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
            data-testid="supplier-trust-tier"
          >
            {trustTiers.map((tier) => (
              <option key={tier.value} value={tier.value} className="bg-brand-card">
                {tier.label}
              </option>
            ))}
          </select>
          {errors.trustTier && (
            <p className="mt-1 text-xs text-brand-danger">{errors.trustTier.message}</p>
          )}
          {isAdmin && (
            <div className="mt-2 flex gap-2">
              {trustTierValue === 'community' && (
                <button
                  type="button"
                  onClick={() => setValue('trustTier', 'verified', { shouldValidate: true })}
                  className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors"
                  data-testid="promote-supplier-btn"
                >
                  Promote to Verified
                </button>
              )}
              {trustTierValue === 'verified' && (
                <button
                  type="button"
                  onClick={() => setValue('trustTier', 'community', { shouldValidate: true })}
                  className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded font-medium transition-colors"
                  data-testid="demote-supplier-btn"
                >
                  Demote to Community
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Status <span className="text-brand-danger">*</span>
          </label>
          <select
            {...register('status')}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
            data-testid="supplier-status"
          >
            {statuses.map((status) => (
              <option key={status.value} value={status.value} className="bg-brand-card">
                {status.label}
              </option>
            ))}
          </select>
          {errors.status && (
            <p className="mt-1 text-xs text-brand-danger">{errors.status.message}</p>
          )}
        </div>
      </div>

      {/* Collapsible Metadata JSON Box */}
      <div className="border border-brand-border rounded-md overflow-hidden">
        <button
          type="button"
          onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-brand-bg hover:bg-brand-border/10 transition-colors text-sm text-brand-text font-medium"
        >
          <span>Metadata Configuration (JSON)</span>
          {isMetadataExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {isMetadataExpanded && (
          <div className="p-4 bg-brand-card border-t border-brand-border">
            <p className="text-xs text-brand-muted mb-2">
              Provide optional metadata configurations for this supplier in structured JSON format.
            </p>
            <textarea
              {...register('metadataString')}
              className="w-full h-32 px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text font-mono text-xs placeholder-brand-muted focus:outline-none focus:border-brand-accent"
              placeholder='{\n  "billingAddress": "123 Street, Brisbane",\n  "customMargin": 0.1\n}'
              data-testid="supplier-metadata"
            />
            {errors.metadataString && (
              <p className="mt-1 text-xs text-brand-danger">{errors.metadataString.message}</p>
            )}
          </div>
        )}
      </div>

      {submitError && (
        <div className="p-3 bg-brand-danger/10 border border-brand-danger/30 text-brand-danger rounded-md text-sm">
          {submitError}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        {onCancel && (
          <Button onClick={onCancel} variant="secondary" disabled={isLoading} data-testid="cancel-btn">
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" disabled={isLoading} data-testid="submit-btn">
          {isLoading ? 'Saving…' : isEditMode ? 'Update Supplier' : 'Create Supplier'}
        </Button>
      </div>
    </form>
  );
}
