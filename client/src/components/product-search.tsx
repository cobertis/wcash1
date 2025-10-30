import { useState, useEffect } from 'react';
import { Search, Package, ShoppingCart, AlertCircle, CheckCircle2, XCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { Skeleton } from '@/components/ui/skeleton';


interface Product {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  price?: number;
  image?: string;
  barcode?: string;
  inventory?: {
    quantity: number;
    lastUpdated: Date;
    storeNumber: string;
    inStock: boolean;
  };
}

interface SearchResult {
  products: Product[];
  totalCount: number;
  page: number;
  size: number;
  query: string;
}

export default function ProductSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [assignedStore, setAssignedStore] = useState<any>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'scanning' | 'found' | 'error'>('scanning');

  // Toast removed - using console.log instead

  useEffect(() => {
    // Get stored member data to check for assigned store
    const storedData = sessionStorage.getItem('walgreens_lookup_data');
    if (storedData) {
      const memberData = JSON.parse(storedData);
      if (memberData.memberData?.assignedStoreNumber) {
        setAssignedStore({
          storeNumber: memberData.memberData.assignedStoreNumber,
          storeName: memberData.memberData.assignedStoreName
        });
      }
    }
  }, []);

  // Camera scanner effect
  useEffect(() => {
    let stream: MediaStream | null = null;
    let codeReader: any = null;
    let isScanning = false;

    const startCamera = async () => {
      if (!showScanner) return;
      isScanning = true;

      try {
        // Request camera access
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        // Get video element
        const video = document.getElementById('camera-preview') as HTMLVideoElement;
        if (video) {
          video.srcObject = stream;
          video.play();

          // Initialize ZXing scanner
          const { BrowserMultiFormatReader } = await import('@zxing/library');
          codeReader = new BrowserMultiFormatReader();

          // Start continuous scanning
          codeReader.decodeFromVideoDevice(undefined, video, (result, err) => {
            if (result) {
              const barcode = result.getText();
              console.log('Barcode detected:', barcode);
              handleBarcodeScanned(barcode);
            }
            if (err && err.name !== 'NotFoundException') {
              console.error('Scanner error:', err);
            }
          });
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setScannerStatus('error');
console.log("Toast removed");
      }
    };

    if (showScanner) {
      startCamera();
    }

    // Cleanup function
    return () => {
      isScanning = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (codeReader) {
        codeReader.reset();
      }
    };
  }, [showScanner]);

  // Cleanup when scanner closes
  useEffect(() => {
    if (!showScanner) {
      const video = document.getElementById('camera-preview') as HTMLVideoElement;
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
      }
    }
  }, [showScanner]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
console.log("Toast removed");
      return;
    }

    if (!assignedStore?.storeNumber) {
console.log("Toast removed");
      return;
    }

    setLoading(true);
    
    try {
      const response = await apiRequest('/api/products/search-with-inventory', {
        method: 'POST',
        body: JSON.stringify({
          query: searchQuery,
          storeNumber: assignedStore.storeNumber,
          page: 1,
          size: 20
        }),
      });

      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching products:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMessage.includes('403') || errorMessage.includes('Unauthorised')) {
console.log("Toast removed");
      } else {
console.log("Toast removed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeSearch = () => {
    if (!assignedStore?.storeNumber) {
console.log("Toast removed");
      return;
    }

    setShowScanner(true);
    setScannerStatus('scanning');
  };

  const handleBarcodeScanned = (barcode: string) => {
    setScannerStatus('found');
    setSearchQuery(barcode);
    
    // Show success message
console.log("Toast removed");

    // Close scanner and execute search immediately
    setShowScanner(false);
    handleSearchByBarcode(barcode);
  };

  const handleScannerClose = () => {
    setShowScanner(false);
    setScannerStatus('scanning');
  };

  const handleSearchByBarcode = async (barcode: string) => {
    setLoading(true);
    
    try {
      const response = await apiRequest('/api/products/search-with-inventory', {
        method: 'POST',
        body: JSON.stringify({
          query: barcode,
          storeNumber: assignedStore.storeNumber,
          page: 1,
          size: 20
        }),
      });

      const results = await response.json();
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching by barcode:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMessage.includes('403') || errorMessage.includes('Unauthorised')) {
console.log("Toast removed");
      } else {
console.log("Toast removed");
      }
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (inventory: Product['inventory']) => {
    if (!inventory) {
      return { status: 'unknown', color: 'gray', text: 'Sin información' };
    }

    const { quantity, inStock } = inventory;
    
    if (!inStock || quantity === 0) {
      return { status: 'out', color: 'red', text: 'Agotado' };
    } else if (quantity <= 3) {
      return { status: 'low', color: 'yellow', text: 'Pocas unidades' };
    } else {
      return { status: 'in', color: 'green', text: 'Disponible' };
    }
  };

  const getStockIcon = (status: string) => {
    switch (status) {
      case 'in':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'low':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'out':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!assignedStore) {
    return (
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Búsqueda de Productos
            </h2>
            <p className="text-gray-600 mb-6">
              Necesitas asignar una tienda para buscar productos y ver el inventario
            </p>
            <Button 
              onClick={() => window.location.href = '/dashboard/localizador'}
              className="bg-red-600 hover:bg-red-700"
            >
              Ir al Localizador de Tiendas
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Búsqueda de Productos
          </h1>
          <p className="text-gray-600">
            Busca productos por nombre o código de barras en tu tienda asignada
          </p>
          {assignedStore && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package className="h-4 w-4" />
                <span>Tienda asignada: {assignedStore.storeName} (#{assignedStore.storeNumber})</span>
              </div>
            </div>
          )}
        </div>

        {/* Search Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Productos
            </CardTitle>
            <CardDescription>
              Ingresa el nombre del producto o código de barras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Ej: tylenol, advil, 123456789..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-12"
                />
                <Button 
                  type="button"
                  onClick={handleBarcodeSearch}
                  disabled={loading}
                  variant="ghost"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-gray-100"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    className="text-gray-500"
                  >
                    <rect x="2" y="6" width="2" height="12" fill="currentColor"/>
                    <rect x="6" y="6" width="1" height="12" fill="currentColor"/>
                    <rect x="9" y="6" width="2" height="12" fill="currentColor"/>
                    <rect x="13" y="6" width="1" height="12" fill="currentColor"/>
                    <rect x="16" y="6" width="2" height="12" fill="currentColor"/>
                    <rect x="20" y="6" width="2" height="12" fill="currentColor"/>
                    <rect x="2" y="2" width="2" height="2" fill="currentColor"/>
                    <rect x="6" y="2" width="2" height="2" fill="currentColor"/>
                    <rect x="20" y="2" width="2" height="2" fill="currentColor"/>
                    <rect x="2" y="20" width="2" height="2" fill="currentColor"/>
                    <rect x="6" y="20" width="2" height="2" fill="currentColor"/>
                    <rect x="20" y="20" width="2" height="2" fill="currentColor"/>
                  </svg>
                </Button>
              </div>
              <Button 
                type="submit" 
                disabled={loading}
                className="w-full bg-red-600 hover:bg-red-700"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-16 w-16 rounded" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Search Results */}
        {searchResults && !loading && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">
                Resultados de búsqueda
              </h2>
              <span className="text-sm text-gray-600">
                {searchResults.totalCount} productos encontrados
              </span>
            </div>

            {searchResults.products.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No se encontraron productos
                  </h3>
                  <p className="text-gray-600">
                    Intenta con un término de búsqueda diferente
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {searchResults.products.map((product) => {
                  const stockStatus = getStockStatus(product.inventory);
                  
                  return (
                    <Card key={product.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                            {product.image ? (
                              <img 
                                src={product.image} 
                                alt={product.name}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Package className="h-8 w-8 text-gray-400" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {product.name}
                            </h3>
                            
                            {product.brand && (
                              <p className="text-sm text-gray-600 mb-1">
                                Marca: {product.brand}
                              </p>
                            )}
                            
                            {product.category && (
                              <p className="text-sm text-gray-600 mb-2">
                                Categoría: {product.category}
                              </p>
                            )}
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                {getStockIcon(stockStatus.status)}
                                <Badge 
                                  variant={stockStatus.color === 'green' ? 'default' : 'secondary'}
                                  className={`
                                    ${stockStatus.color === 'green' ? 'bg-green-100 text-green-800' : ''}
                                    ${stockStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : ''}
                                    ${stockStatus.color === 'red' ? 'bg-red-100 text-red-800' : ''}
                                  `}
                                >
                                  {stockStatus.text}
                                </Badge>
                              </div>
                              
                              {product.inventory && (
                                <span className="text-sm text-gray-600">
                                  Cantidad: {product.inventory.quantity}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {product.price && (
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                ${product.price.toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {product.inventory?.lastUpdated && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Última actualización: {new Date(product.inventory.lastUpdated).toLocaleString('es-ES')}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Screen Camera Scanner */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black text-white">
            <h2 className="text-lg font-semibold">Escanear Código de Barras</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleScannerClose}
              className="text-white hover:bg-gray-800"
            >
              <XCircle className="h-5 w-5" />
            </Button>
          </div>

          {/* Camera View */}
          <div className="flex-1 relative">
            <video
              id="camera-preview"
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="border-2 border-white w-64 h-40 rounded-lg relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-red-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-red-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-red-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-red-500 rounded-br-lg"></div>
                
                {/* Status indicator */}
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center">
                  {scannerStatus === 'scanning' && (
                    <div className="text-white text-sm">
                      <div className="animate-pulse">🔍 Buscando código...</div>
                    </div>
                  )}
                  {scannerStatus === 'found' && (
                    <div className="text-green-400 text-sm font-bold">
                      ✓ ¡Código detectado!
                    </div>
                  )}
                  {scannerStatus === 'error' && (
                    <div className="text-red-400 text-sm">
                      ❌ Error al escanear
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-black text-white text-center">
            <p className="text-sm">
              Apunta la cámara hacia el código de barras del producto
            </p>
          </div>
        </div>
      )}
    </div>
  );
}