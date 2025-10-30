import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Package, Clock, AlertCircle, MapPin } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

interface InventoryItem {
  id: string;
  s: string; // store number
  q: number; // quantity
  ut: number; // update time epoch
}

interface StoreInventoryProps {
  storeNumber?: string;
  storeName?: string;
}

export default function StoreInventory({ storeNumber, storeName }: StoreInventoryProps) {
  const [productIds, setProductIds] = useState<string>('');
  const [upcCode, setUpcCode] = useState<string>('');
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([]);
  const [searchPerformed, setSearchPerformed] = useState(false);
  // Toast removed - using console.log instead
  const [, navigate] = useLocation();

  const inventoryMutation = useMutation({
    mutationFn: async (data: { storeNumber: string; productIds?: string[] }) => {
      const response = await apiRequest('/api/inventory/check', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data) => {
      setInventoryData(Array.isArray(data) ? data : []);
      setSearchPerformed(true);
console.log("Toast removed");
    },
    onError: (error) => {
      console.error('Error checking inventory:', error);
console.log("Toast removed");
    },
  });

  // NEW: UPC Search mutation (inspired by Project-1-Basix)
  const upcSearchMutation = useMutation({
    mutationFn: async (data: { upc: string; storeNumber: string }) => {
      const response = await apiRequest('/api/inventory/upc-search', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.product) {
        const product = data.product;
console.log("Toast removed");
        
        // Navigate to product details or show in current view
        console.log('Product found:', product);
      } else {
console.log("Toast removed");
      }
    },
    onError: (error) => {
      console.error('Error searching UPC:', error);
console.log("Toast removed");
    },
  });

  const handleCheckInventory = () => {
    if (!storeNumber) {
console.log("Toast removed");
      return;
    }

    const productIdsList = productIds.trim() 
      ? productIds.split(',').map(id => id.trim()).filter(id => id)
      : undefined;

    inventoryMutation.mutate({
      storeNumber,
      productIds: productIdsList,
    });
  };

  // NEW: Handle UPC search
  const handleUPCSearch = () => {
    if (!storeNumber) {
console.log("Toast removed");
      return;
    }

    if (!upcCode.trim()) {
console.log("Toast removed");
      return;
    }

    upcSearchMutation.mutate({
      upc: upcCode.trim(),
      storeNumber,
    });
  };

  const formatUpdateTime = (epochTime: number) => {
    const date = new Date(epochTime * 1000);
    return date.toLocaleString('es-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) {
      return { text: "Agotado", variant: "destructive" as const, icon: AlertCircle };
    } else if (quantity <= 5) {
      return { text: "Pocas unidades", variant: "secondary" as const, icon: Package };
    } else {
      return { text: "En stock", variant: "default" as const, icon: Package };
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Consultar Inventario
          </CardTitle>
          <CardDescription>
            Verifica la disponibilidad de productos en tu tienda asignada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {storeNumber && storeName ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <Package className="h-4 w-4" />
                <span className="font-medium">Tienda Asignada: {storeName}</span>
              </div>
              <p className="text-red-600 text-sm mt-1">Número de tienda: {storeNumber}</p>
              <p className="text-red-600 text-xs mt-1">El inventario se consultará automáticamente para esta tienda</p>
            </div>
          ) : (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Tienda no asignada</span>
              </div>
              <p className="text-yellow-600 text-sm mt-1 mb-3">
                Necesitas asignar una tienda para consultar inventario.
              </p>
              <Button 
                onClick={() => navigate('/dashboard/stores')}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Ir a Localizador de Tiendas
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="productIds">IDs de Productos (opcional)</Label>
            <Input
              id="productIds"
              placeholder="Ejemplo: 123456, 789012, 345678"
              value={productIds}
              onChange={(e) => setProductIds(e.target.value)}
              disabled={inventoryMutation.isPending}
            />
            <p className="text-sm text-gray-600">
              Separa múltiples IDs con comas. Deja vacío para consultar todo el inventario.
            </p>
          </div>

          <Button 
            onClick={handleCheckInventory}
            disabled={!storeNumber || inventoryMutation.isPending}
            className="w-full"
          >
            {inventoryMutation.isPending ? (
              <>
                <Search className="h-4 w-4 mr-2 animate-spin" />
                Consultando...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Consultar Inventario
              </>
            )}
          </Button>

          <Separator className="my-4" />

          {/* NEW: UPC Search Section */}
          <div className="space-y-2">
            <Label htmlFor="upcCode">Buscar por Código UPC</Label>
            <Input
              id="upcCode"
              placeholder="Ejemplo: 033200200192"
              value={upcCode}
              onChange={(e) => setUpcCode(e.target.value)}
              disabled={upcSearchMutation.isPending}
              className="font-mono"
            />
            <p className="text-sm text-gray-600">
              Ingresa el código UPC para buscar un producto específico.
            </p>
          </div>

          <Button 
            onClick={handleUPCSearch}
            disabled={!storeNumber || upcSearchMutation.isPending}
            className="w-full"
            variant="outline"
          >
            {upcSearchMutation.isPending ? (
              <>
                <Search className="h-4 w-4 mr-2 animate-spin" />
                Buscando UPC...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Buscar por UPC
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {searchPerformed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Resultados de Inventario
            </CardTitle>
            <CardDescription>
              {inventoryData.length === 0 
                ? "No se encontraron productos en el inventario" 
                : `${inventoryData.length} producto${inventoryData.length === 1 ? '' : 's'} encontrado${inventoryData.length === 1 ? '' : 's'}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inventoryData.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">No se encontraron productos en el inventario</p>
                <p className="text-sm text-gray-500 mt-2">
                  Intenta con diferentes IDs de productos o consulta todo el inventario
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {inventoryData.map((item, index) => {
                  const stockStatus = getStockStatus(item.q);
                  const Icon = stockStatus.icon;
                  
                  return (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium">Producto ID: {item.id}</p>
                            <p className="text-sm text-gray-600">Tienda: {item.s}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={stockStatus.variant} className="mb-1">
                            {stockStatus.text}
                          </Badge>
                          <p className="text-sm text-gray-600">
                            Cantidad: {item.q}
                          </p>
                        </div>
                      </div>
                      
                      <Separator className="my-3" />
                      
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span>Última actualización: {formatUpdateTime(item.ut)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}