import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { ProductForm } from '../../components/admin/ProductForm';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export function ProductEditPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const isEditMode = !!id;

  // Fetch product detail for edit mode
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['admin', 'product', id],
    queryFn: async () => {
      const { data, error: err } = await supabase
        .from('products')
        .select('*')
        .eq('id', id!)
        .single();
      if (err) throw err;
      return data;
    },
    enabled: isEditMode,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error: err } = await supabase
        .from('products')
        .upsert(payload)
        .select('*')
        .single();
      if (err) throw err;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'product', id] });
      }
      toast.success(isEditMode ? 'Product updated successfully' : 'Product created successfully');
      navigate('/admin/products');
    },
    onError: (err: any) => {
      toast.error(`Failed to save product: ${err.message}`);
    },
  });

  const handleCancel = () => {
    navigate('/admin/products');
  };

  const handleSubmit = async (data: any) => {
    await saveMutation.mutateAsync(data);
  };

  return (
    <AdminLayout
      title={isEditMode ? `Edit Product: ${product?.name ?? ''}` : 'New Product'}
      subtitle={isEditMode ? 'Update product metadata, compatibility, or supplier associations.' : 'Register a new product configuration.'}
    >
      {isEditMode && isLoading ? (
        <div className="text-sm text-brand-muted animate-pulse">Loading product details…</div>
      ) : isEditMode && error ? (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-lg text-sm text-brand-danger">
          {(error as Error).message}
        </div>
      ) : (
        <ProductForm
          initialData={product ?? undefined}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={saveMutation.isPending}
        />
      )}
    </AdminLayout>
  );
}
export default ProductEditPage;
