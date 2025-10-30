import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Filter, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface FilterOptions {
  category?: string;
  minValue?: number;
  maxValue?: number;
  brand?: string;
  expiringBefore?: string;
  offerType?: string;
  sortBy?: 'value' | 'expiry' | 'brand' | 'category';
  sortOrder?: 'asc' | 'desc';
}

interface AdvancedOfferFiltersProps {
  onApplyFilters: (filters: FilterOptions) => void;
  isLoading?: boolean;
}

const categories = [
  'Beauty',
  'Personal Care',
  'Medicines & Treatments',
  'Vitamins & Supplements',
  'Household',
  'Baby, Kids & Toys',
  'Grocery',
  'Home Medical',
  'Other'
];

const brands = [
  'Walgreens',
  'Tylenol',
  'Advil',
  'Neutrogena',
  'L\'Oreal',
  'Olay',
  'Tide',
  'Pampers',
  'Colgate',
  'Centrum',
  'Fitbit',
  'Hallmark',
  'Gatorade'
];

export default function AdvancedOfferFilters({ onApplyFilters, isLoading }: AdvancedOfferFiltersProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    minValue: 0,
    maxValue: 50,
    sortBy: 'value',
    sortOrder: 'desc'
  });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [expiryDate, setExpiryDate] = useState<Date>();

  const handleValueChange = (values: number[]) => {
    setFilters(prev => ({
      ...prev,
      minValue: values[0],
      maxValue: values[1]
    }));
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    const finalFilters = {
      ...filters,
      expiringBefore: expiryDate ? format(expiryDate, 'yyyy-MM-dd') : undefined
    };
    
    // Update active filters for display
    const active = [];
    if (finalFilters.category) active.push(`Categoría: ${finalFilters.category}`);
    if (finalFilters.brand) active.push(`Marca: ${finalFilters.brand}`);
    if (finalFilters.minValue && finalFilters.minValue > 0) active.push(`Min: $${finalFilters.minValue}`);
    if (finalFilters.maxValue && finalFilters.maxValue < 50) active.push(`Max: $${finalFilters.maxValue}`);
    if (finalFilters.expiringBefore) active.push(`Expira antes: ${format(expiryDate!, 'dd/MM/yyyy')}`);
    if (finalFilters.sortBy && finalFilters.sortBy !== 'value') active.push(`Orden: ${finalFilters.sortBy}`);
    if (finalFilters.sortOrder && finalFilters.sortOrder !== 'desc') active.push(`Orden: ${finalFilters.sortOrder}`);
    
    setActiveFilters(active);
    console.log('Aplicando filtros:', finalFilters);
    onApplyFilters(finalFilters);
  };

  const handleClearFilters = () => {
    setFilters({
      minValue: 0,
      maxValue: 50,
      sortBy: 'value',
      sortOrder: 'desc'
    });
    setExpiryDate(undefined);
    setActiveFilters([]);
    onApplyFilters({});
  };

  const removeFilter = (filterText: string) => {
    const newFilters = { ...filters };
    
    if (filterText.includes('Categoría:')) {
      newFilters.category = undefined;
    } else if (filterText.includes('Marca:')) {
      newFilters.brand = undefined;
    } else if (filterText.includes('Min:')) {
      newFilters.minValue = 0;
    } else if (filterText.includes('Max:')) {
      newFilters.maxValue = 50;
    } else if (filterText.includes('Expira antes:')) {
      newFilters.expiringBefore = undefined;
      setExpiryDate(undefined);
    }
    
    setFilters(newFilters);
    setActiveFilters(prev => prev.filter(f => f !== filterText));
    onApplyFilters(newFilters);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avanzados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category Filter */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand Filter */}
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Select value={filters.brand} onValueChange={(value) => handleFilterChange('brand', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar marca" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Value Range Filter */}
            <div className="space-y-2 md:col-span-2">
              <Label>Rango de Valor: ${filters.minValue} - ${filters.maxValue}</Label>
              <Slider
                value={[filters.minValue || 0, filters.maxValue || 50]}
                onValueChange={handleValueChange}
                max={50}
                min={0}
                step={1}
                className="w-full"
              />
            </div>

            {/* Expiry Date Filter */}
            <div className="space-y-2">
              <Label>Expira antes de</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expiryDate ? format(expiryDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={expiryDate}
                    onSelect={setExpiryDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Sort Options */}
            <div className="space-y-2">
              <Label>Ordenar por</Label>
              <div className="flex gap-2">
                <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="value">Valor</SelectItem>
                    <SelectItem value="expiry">Fecha de expiración</SelectItem>
                    <SelectItem value="brand">Marca</SelectItem>
                    <SelectItem value="category">Categoría</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.sortOrder} onValueChange={(value) => handleFilterChange('sortOrder', value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descendente</SelectItem>
                    <SelectItem value="asc">Ascendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleApplyFilters} disabled={isLoading} className="flex-1">
              {isLoading ? 'Aplicando...' : 'Aplicar Filtros'}
            </Button>
            <Button onClick={handleClearFilters} variant="outline">
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Filters Display */}
      {activeFilters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filtros Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {filter}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => removeFilter(filter)}
                  />
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}