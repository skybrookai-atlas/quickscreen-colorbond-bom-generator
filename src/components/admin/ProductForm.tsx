import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { listAllSuppliers, listSystemInstances } from '../../lib/multiSupplier/queries';
import { Button } from '../ui/Button';

const productFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  system_type: z.string()
    .min(1, 'System type code is required')
    .regex(/^[A-Z0-9_-]+$/, 'System type must contain only uppercase alphanumeric characters, hyphens, and underscores'),
  product_type: z.enum(['fence', 'gate', 'other']),
  description: z.string().optional(),
  active: z.boolean(),
  compatibleWithSystemTypes: z.array(z.string()),
  supplier_id: z.string().uuid('Please select a supplier').or(z.literal('')).nullable().optional(),
  system_instance_id: z.string().uuid('Please select an instance').or(z.literal('')).nullable().optional(),
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

type ProductFormData = z.infer<typeof productFormSchema>;

interface ProductFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ProductForm({ initialData, onSubmit, onCancel, isLoading }: ProductFormProps) {
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isSystemTypeManuallyEdited = useRef(false);

  const isEditMode = !!initialData?.id;

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery({
    queryKey: ['admin', 'suppliers', 'all'],
    queryFn: listAllSuppliers,
  });

  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ['admin', 'instances', 'all'],
    queryFn: () => listSystemInstances(),
  });

  const defaultValues: ProductFormData = {
    name: initialData?.name ?? '',
    system_type: initialData?.system_type ?? '',
    product_type: initialData?.product_type ?? 'fence',
    description: initialData?.description ?? '',
    active: initialData?.active ?? true,
    compatibleWithSystemTypes: initialData?.compatible_with_system_types ?? [],
    supplier_id: initialData?.supplier_id ?? '',
    system_instance_id: initialData?.system_instance_id ?? '',
    metadataString: initialData?.metadata ? JSON.stringify(initialData.metadata, null, 2) : '',
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
  });

  const nameValue = watch('name');
  const productTypeValue = watch('product_type');

  // Auto-generate system_type code from Name (uppercase, hyphenated)
  useEffect(() => {
    if (!isEditMode && !isSystemTypeManuallyEdited.current) {
      const generatedCode = (nameValue || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '');
      setValue('system_type', generatedCode, { shouldValidate: true });
    }
  }, [nameValue, isEditMode, setValue]);

  const onFormSubmit = async (data: ProductFormData) => {
    try {
      setSubmitError(null);
      let parsedMetadata: Record<string, unknown> = {};
      if (data.metadataString.trim()) {
        parsedMetadata = JSON.parse(data.metadataString);
      }

      await onSubmit({
        id: initialData?.id || crypto.randomUUID(),
        name: data.name,
        system_type: data.system_type,
        product_type: data.product_type,
        description: data.description || null,
        active: data.active,
        compatible_with_system_types: data.compatibleWithSystemTypes,
        supplier_id: data.supplier_id || null,
        system_instance_id: data.system_instance_id || null,
        metadata: parsedMetadata,
        org_id: initialData?.org_id,
      });
    } catch (err: any) {
      setSubmitError(err.message || 'An error occurred while saving the product.');
    }
  };

  const availableSystemTypes = ['QSHS', 'VS', 'XPL', 'BAYG', 'GATE'];

  const handleCheckboxChange = (sysType: string, checked: boolean) => {
    const current = watch('compatibleWithSystemTypes') || [];
    if (checked) {
      setValue('compatibleWithSystemTypes', [...current, sysType], { shouldValidate: true });
    } else {
      setValue('compatibleWithSystemTypes', current.filter((s) => s !== sysType), { shouldValidate: true });
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 max-w-2xl bg-brand-card border border-brand-border p-6 rounded-md">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Product Name <span className="text-brand-danger">*</span>
          </label>
          <input
            {...register('name')}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm"
            placeholder="e.g. QSHS Horizontal Slat Fence"
            data-testid="product-name"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-brand-danger">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            System Type Code <span className="text-brand-danger">*</span>
          </label>
          <input
            {...register('system_type', {
              onChange: () => {
                isSystemTypeManuallyEdited.current = true;
              },
            })}
            type="text"
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm disabled:opacity-60"
            placeholder="e.g. QSHS"
            disabled={isEditMode}
            data-testid="product-system-type"
          />
          {errors.system_type && (
            <p className="mt-1 text-xs text-brand-danger">{errors.system_type.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Product Type <span className="text-brand-danger">*</span>
          </label>
          <select
            {...register('product_type')}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
            data-testid="product-type-select"
          >
            <option value="fence">Fence</option>
            <option value="gate">Gate</option>
            <option value="other">Other</option>
          </select>
          {errors.product_type && (
            <p className="mt-1 text-xs text-brand-danger">{errors.product_type.message}</p>
          )}
        </div>

        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2 text-sm text-brand-text cursor-pointer select-none">
            <input
              {...register('active')}
              type="checkbox"
              className="accent-brand-accent"
              data-testid="product-active"
            />
            Active in catalogue
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            Supplier
          </label>
          <select
            {...register('supplier_id')}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
            disabled={loadingSuppliers}
            data-testid="product-supplier-id"
          >
            <option value="">{loadingSuppliers ? 'Loading suppliers…' : 'Select a Supplier'}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {errors.supplier_id && (
            <p className="mt-1 text-xs text-brand-danger">{errors.supplier_id.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-brand-text mb-1">
            System Instance
          </label>
          <select
            {...register('system_instance_id')}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text focus:outline-none focus:border-brand-accent text-sm"
            disabled={loadingInstances}
            data-testid="product-instance-id"
          >
            <option value="">{loadingInstances ? 'Loading instances…' : 'Select an Instance'}</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.slug})
              </option>
            ))}
          </select>
          {errors.system_instance_id && (
            <p className="mt-1 text-xs text-brand-danger">{errors.system_instance_id.message}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-brand-text mb-1">
            Description
          </label>
          <textarea
            {...register('description')}
            className="w-full px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-accent text-sm h-20"
            placeholder="Describe the product and its usage/specifications."
            data-testid="product-description"
          />
        </div>

        {productTypeValue === 'gate' && (
          <div className="md:col-span-2 border border-brand-border p-4 rounded-md bg-brand-bg/20">
            <label className="block text-sm font-medium text-brand-text mb-2">
              Compatible Fence Systems
            </label>
            <div className="flex flex-wrap gap-4">
              {availableSystemTypes.map((st) => (
                <label key={st} className="flex items-center gap-2 text-xs text-brand-text cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(watch('compatibleWithSystemTypes') || []).includes(st)}
                    onChange={(e) => handleCheckboxChange(st, e.target.checked)}
                    className="accent-brand-accent"
                    data-testid={`compatible-${st}`}
                  />
                  {st}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

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
            <textarea
              {...register('metadataString')}
              className="w-full h-32 px-3 py-2 bg-brand-bg border border-brand-border rounded-md text-brand-text font-mono text-xs placeholder-brand-muted focus:outline-none focus:border-brand-accent"
              placeholder='{\n  "allowedAngles": [90, 135, 180]\n}'
              data-testid="product-metadata"
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
          {isLoading ? 'Saving…' : isEditMode ? 'Update Product' : 'Create Product'}
        </Button>
      </div>
    </form>
  );
}
