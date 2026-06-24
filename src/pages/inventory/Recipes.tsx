import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Plus, Trash2, Edit, FlaskConical, Search } from 'lucide-react';
import { toast } from 'sonner';
import { unitOptions, smallestUnitOf, findUnit } from '@/lib/units';

interface RecipeItem {
  id?: string;
  product_id: string;
  quantity: number;
  unit: string;
  notes: string;
  product_name?: string;
}

interface Recipe {
  id: string;
  recipe_code: string;
  name: string;
  description: string | null;
  product_id: string;
  output_quantity: number;
  unit: string;
  is_active: boolean;
  product_name?: string;
  items?: RecipeItem[];
}

export default function Recipes() {
  const { selectedCompany } = useCompany();
  const { products } = useProducts();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  
  const [formData, setFormData] = useState({
    recipe_code: '',
    name: '',
    description: '',
    product_id: '',
    output_quantity: 1,
    unit: 'pcs',
  });
  
  const [recipeItems, setRecipeItems] = useState<RecipeItem[]>([]);

  const fetchRecipes = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    
    // Fetch recipes
    const { data: recipesData, error: recipesError } = await supabase
      .from('recipes')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('recipe_code');

    if (recipesError) {
      console.error(recipesError);
      setIsLoading(false);
      return;
    }

    // Get product names for each recipe
    const recipesWithDetails = await Promise.all(
      (recipesData || []).map(async (recipe) => {
        // Get output product name
        const { data: productData } = await supabase
          .from('products')
          .select('name')
          .eq('id', recipe.product_id)
          .single();

        // Get recipe items
        const { data: itemsData } = await supabase
          .from('recipe_items')
          .select('*')
          .eq('recipe_id', recipe.id);

        // Get product names for items
        const itemsWithNames = await Promise.all(
          (itemsData || []).map(async (item) => {
            const { data: itemProduct } = await supabase
              .from('products')
              .select('name')
              .eq('id', item.product_id)
              .single();
            return {
              ...item,
              product_name: itemProduct?.name
            };
          })
        );

        return {
          ...recipe,
          product_name: productData?.name,
          items: itemsWithNames
        };
      })
    );

    setRecipes(recipesWithDetails);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRecipes();
  }, [selectedCompany]);

  const resetForm = () => {
    setFormData({
      recipe_code: '',
      name: '',
      description: '',
      product_id: '',
      output_quantity: 1,
      unit: 'pcs',
    });
    setRecipeItems([]);
    setEditingRecipe(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    if (!formData.product_id) {
      toast.error('Pilih produk output');
      return;
    }

    if (recipeItems.length === 0) {
      toast.error('Tambahkan minimal 1 bahan baku');
      return;
    }

    try {
      if (editingRecipe) {
        const { error } = await supabase
          .from('recipes')
          .update({
            recipe_code: formData.recipe_code,
            name: formData.name,
            description: formData.description || null,
            product_id: formData.product_id,
            output_quantity: formData.output_quantity,
            unit: formData.unit,
          })
          .eq('id', editingRecipe.id);

        if (error) throw error;

        // Delete existing items and re-insert
        await supabase
          .from('recipe_items')
          .delete()
          .eq('recipe_id', editingRecipe.id);

        const itemsToInsert = recipeItems.map(item => ({
          recipe_id: editingRecipe.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || null,
        }));

        const { error: itemsError } = await supabase
          .from('recipe_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast.success('Recipe berhasil diupdate');
      } else {
        const { data, error } = await supabase
          .from('recipes')
          .insert({
            company_id: selectedCompany.id,
            recipe_code: formData.recipe_code,
            name: formData.name,
            description: formData.description || null,
            product_id: formData.product_id,
            output_quantity: formData.output_quantity,
            unit: formData.unit,
          })
          .select()
          .single();

        if (error) throw error;

        const itemsToInsert = recipeItems.map(item => ({
          recipe_id: data.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit: item.unit,
          notes: item.notes || null,
        }));

        const { error: itemsError } = await supabase
          .from('recipe_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        toast.success('Recipe berhasil ditambahkan');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchRecipes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEdit = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setFormData({
      recipe_code: recipe.recipe_code,
      name: recipe.name,
      description: recipe.description || '',
      product_id: recipe.product_id,
      output_quantity: recipe.output_quantity,
      unit: recipe.unit,
    });
    setRecipeItems(recipe.items || []);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus recipe ini?')) return;

    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Recipe berhasil dihapus');
      fetchRecipes();
    }
  };

  const addRecipeItem = () => {
    setRecipeItems([...recipeItems, {
      product_id: '',
      quantity: 1,
      unit: 'pcs',
      notes: '',
    }]);
  };

  const updateRecipeItem = (index: number, field: keyof RecipeItem, value: any) => {
    const updated = [...recipeItems];
    updated[index] = { ...updated[index], [field]: value };
    setRecipeItems(updated);
  };

  const removeRecipeItem = (index: number) => {
    setRecipeItems(recipeItems.filter((_, i) => i !== index));
  };

  const filteredRecipes = recipes.filter(r =>
    r.recipe_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Only raw materials for recipe items
  const rawMaterials = products.filter(p => p.product_type === 'raw_material');
  
  // Stockable products for output
  const stockableProducts = products.filter(p => p.product_type === 'stockable');

  const productOptions = stockableProducts.map(p => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`
  }));

  const materialOptions = rawMaterials.map(p => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`
  }));

  // Pick smallest unit of the selected material so quantities are in atomic units (e.g. kg -> g)
  const handleMaterialChange = (index: number, productId: string) => {
    const mat = rawMaterials.find(p => p.id === productId);
    const matUnit = mat?.unit || 'pcs';
    const smallest = smallestUnitOf(matUnit);
    const updated = [...recipeItems];
    updated[index] = { ...updated[index], product_id: productId, unit: smallest };
    setRecipeItems(updated);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Recipe / BOM</h1>
          <p className="text-muted-foreground text-sm">Kelola resep dan bill of materials</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Recipe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRecipe ? 'Edit Recipe' : 'Tambah Recipe Baru'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kode Recipe *</Label>
                  <Input
                    value={formData.recipe_code}
                    onChange={(e) => setFormData({ ...formData, recipe_code: e.target.value })}
                    placeholder="RCP-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nama Recipe *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nama recipe"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Produk Output *</Label>
                <SearchableSelect
                  options={productOptions}
                  value={formData.product_id}
                  onChange={(value) => setFormData({ ...formData, product_id: value })}
                  placeholder="Pilih produk yang dihasilkan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Jumlah Output</Label>
                  <Input
                    type="number"
                    value={formData.output_quantity}
                    onChange={(e) => setFormData({ ...formData, output_quantity: parseFloat(e.target.value) || 1 })}
                    min="0.01"
                    step="0.01"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Satuan</Label>
                  <SearchableSelect
                    options={unitOptions()}
                    value={formData.unit}
                    onChange={(value) => setFormData({ ...formData, unit: value })}
                    placeholder="Pilih satuan"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Deskripsi recipe"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Bahan Baku (Materials)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addRecipeItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah Bahan
                  </Button>
                </div>

                {recipeItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    Belum ada bahan baku. Klik "Tambah Bahan" untuk menambahkan.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Material</TableHead>
                          <TableHead className="w-24">Qty</TableHead>
                          <TableHead className="w-24">Satuan</TableHead>
                          <TableHead className="w-32">Catatan</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recipeItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <SearchableSelect
                                options={materialOptions}
                                value={item.product_id}
                                onChange={(value) => handleMaterialChange(index, value)}
                                placeholder="Pilih material"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateRecipeItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                min="0.01"
                                step="0.01"
                              />
                            </TableCell>
                            <TableCell>
                              <SearchableSelect
                                options={(() => {
                                  const mat = rawMaterials.find(p => p.id === item.product_id);
                                  const grp = findUnit(mat?.unit || '')?.group;
                                  const opts = unitOptions().filter(o => !grp || findUnit(o.value)?.group === grp);
                                  return opts.length ? opts : unitOptions();
                                })()}
                                value={item.unit}
                                onChange={(value) => updateRecipeItem(index, 'unit', value)}
                                placeholder="Satuan"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.notes}
                                onChange={(e) => updateRecipeItem(index, 'notes', e.target.value)}
                                placeholder="Catatan"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRecipeItem(index)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit">
                  {editingRecipe ? 'Update' : 'Simpan'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari recipe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
      ) : filteredRecipes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FlaskConical className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada recipe</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRecipes.map((recipe) => (
            <Card key={recipe.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{recipe.recipe_code} - {recipe.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Output: {recipe.product_name} ({recipe.output_quantity} {recipe.unit})
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(recipe)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(recipe.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {recipe.description && (
                  <p className="text-sm text-muted-foreground mb-3">{recipe.description}</p>
                )}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead>Satuan</TableHead>
                        <TableHead>Catatan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipe.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.product_name || '-'}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell>{item.unit}</TableCell>
                          <TableCell className="text-muted-foreground">{item.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
