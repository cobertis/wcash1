import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { MapPin, Clock, Phone, Navigation, Filter, Star } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { apiRequest } from '../lib/queryClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Store {
  storeNumber: string;
  storeName: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  phone: string;
  distance?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  hours: {
    [key: string]: string;
  };
  services: string[];
  isOpen: boolean;
  pharmacy?: {
    phone: string;
    hours: {
      [key: string]: string;
    };
  };
}

interface StoreSearchResponse {
  stores: Store[];
  totalCount: number;
  message?: string;
}

interface LocationSearchForm {
  latitude: string;
  longitude: string;
  radius: number;
}

interface AddressSearchForm {
  address: string;
  radius: number;
}

interface ZipCodeSearchForm {
  zipCode: string;
  radius: number;
}

export default function StoreLocator() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ [key: string]: string }>({});
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [assigningStore, setAssigningStore] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState(null);
  
  // Toast removed - using console.log instead
  const queryClient = useQueryClient();
  
  // Get the stored member data
  const storedLookupData = sessionStorage.getItem('walgreens_lookup_data');
  const lookupData = storedLookupData ? JSON.parse(storedLookupData) : null;
  const memberData = lookupData?.memberData || null;
  
  // Listen for sessionStorage changes to update assigned store
  useEffect(() => {
    const handleStorageChange = () => {
      const updatedData = sessionStorage.getItem('walgreens_lookup_data');
      setSessionData(updatedData ? JSON.parse(updatedData) : null);
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('sessionStorageUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sessionStorageUpdated', handleStorageChange);
    };
  }, []);
  
  // Get current assigned store
  const currentAssignedStore = sessionData?.memberData || memberData;
  

  
  // Create the assign store mutation
  const assignStoreMutation = useMutation({
    mutationFn: async ({ phoneNumber, storeData }: { phoneNumber: string; storeData: any }) => {
      return apiRequest(`/api/members/assign-store`, {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          ...storeData
        }),
      });
    },
    onSuccess: async (data) => {
console.log("Toast removed");
      
      // Use the data returned from the assignment
      const updatedLookupData = { ...lookupData, memberData: { ...memberData, ...data } };
      sessionStorage.setItem('walgreens_lookup_data', JSON.stringify(updatedLookupData));
      
      // Dispatch custom event to notify dashboard of changes
      window.dispatchEvent(new CustomEvent('sessionStorageUpdated'));
      
      queryClient.invalidateQueries({ queryKey: ['/api/members'] });
      setAssigningStore(null);
    },
    onError: (error) => {
console.log("Toast removed");
      setAssigningStore(null);
    },
  });
  
  // Function to assign store to member
  const handleAssignStore = async (store: Store) => {
    if (!lookupData?.phoneNumber) {
console.log("Toast removed");
      return;
    }
    
    setAssigningStore(store.storeNumber);
    
    const storeData = {
      storeNumber: store.storeNumber,
      storeName: store.storeName,
      storeAddress: store.address,
      storePhone: store.phone,
    };
    
    assignStoreMutation.mutate({ phoneNumber: lookupData.phoneNumber, storeData });
  };
  
  const [locationForm, setLocationForm] = useState<LocationSearchForm>({
    latitude: '',
    longitude: '',
    radius: 10
  });
  
  const [addressForm, setAddressForm] = useState<AddressSearchForm>({
    address: '',
    radius: 10
  });
  
  const [zipCodeForm, setZipCodeForm] = useState<ZipCodeSearchForm>({
    zipCode: '',
    radius: 10
  });

  useEffect(() => {
    loadFilterOptions();
  }, []);

  const loadFilterOptions = async () => {
    try {
      const response = await apiRequest('/api/stores/filter-options', {
        method: 'GET',
      });
      const options = await response.json();
      setFilterOptions(options);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    
    if (!navigator.geolocation) {
      setError('La geolocalización no está soportada en este navegador');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLocationForm({
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          radius: 10
        });
        setGettingLocation(false);
      },
      (error) => {
        setError('Error obteniendo la ubicación: ' + error.message);
        setGettingLocation(false);
      }
    );
  };

  const searchByLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/stores/search/location', {
        method: 'POST',
        body: JSON.stringify({
          lat: parseFloat(locationForm.latitude),
          lng: parseFloat(locationForm.longitude),
          radius: locationForm.radius,
          filterOptions: selectedFilters
        }),
      });

      const result = await response.json();
      setStores(result.stores || []);
    } catch (error) {
      setError('Error buscando tiendas por ubicación: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchByAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/stores/search/address', {
        method: 'POST',
        body: JSON.stringify({
          address: addressForm.address,
          radius: addressForm.radius,
          filterOptions: selectedFilters
        }),
      });

      const result = await response.json();
      setStores(result.stores || []);
    } catch (error) {
      setError('Error buscando tiendas por dirección: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchByZipCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiRequest('/api/stores/search/zipcode', {
        method: 'POST',
        body: JSON.stringify({
          zipCode: zipCodeForm.zipCode,
          radius: zipCodeForm.radius,
          filterOptions: selectedFilters
        }),
      });

      const result = await response.json();
      setStores(result.stores || []);
    } catch (error) {
      setError('Error buscando tiendas por código postal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterId: string, checked: boolean) => {
    if (checked) {
      setSelectedFilters([...selectedFilters, filterId]);
    } else {
      setSelectedFilters(selectedFilters.filter(id => id !== filterId));
    }
  };

  const clearFilters = () => {
    setSelectedFilters([]);
  };

  const formatDistance = (distance: number) => {
    return distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`;
  };

  const formatAddress = (address: Store['address']) => {
    return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}`;
  };

  const getDayName = (day: string) => {
    const days = {
      'monday': 'Lunes',
      'tuesday': 'Martes',
      'wednesday': 'Miércoles',
      'thursday': 'Jueves',
      'friday': 'Viernes',
      'saturday': 'Sábado',
      'sunday': 'Domingo'
    };
    return days[day] || day;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      {/* Tienda Asignada */}
      {currentAssignedStore?.assignedStoreNumber && (
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-red-800 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Tu Tienda Asignada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-red-700">Nombre:</span>
                  <span className="text-sm font-medium text-red-800">{currentAssignedStore.assignedStoreName}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-red-700">Número:</span>
                  <span className="text-sm font-medium text-red-800">#{currentAssignedStore.assignedStoreNumber}</span>
                </div>
                {currentAssignedStore.assignedStorePhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-700">Teléfono:</span>
                    <span className="text-sm font-medium text-red-800">{currentAssignedStore.assignedStorePhone}</span>
                  </div>
                )}
              </div>
              <div>
                {currentAssignedStore.assignedStoreAddress && (
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-red-700">Dirección:</span>
                    <span className="text-sm font-medium text-red-800 text-right">
                      {currentAssignedStore.assignedStoreAddress.street}<br />
                      {currentAssignedStore.assignedStoreAddress.city}, {currentAssignedStore.assignedStoreAddress.state} {currentAssignedStore.assignedStoreAddress.zipCode}
                    </span>
                  </div>
                )}
                {currentAssignedStore.storeAssignedAt && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-red-700">Asignada el:</span>
                    <span className="text-sm font-medium text-red-800">{new Date(currentAssignedStore.storeAssignedAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Localizador de Tiendas Walgreens
          </CardTitle>
          <CardDescription>
            Encuentra las tiendas Walgreens más cercanas a ti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="location" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="location">Ubicación Actual</TabsTrigger>
              <TabsTrigger value="address">Dirección</TabsTrigger>
              <TabsTrigger value="zipcode">Código Postal</TabsTrigger>
            </TabsList>

            <TabsContent value="location" className="space-y-4">
              <form onSubmit={searchByLocation} className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    variant="outline"
                    className="whitespace-nowrap"
                  >
                    {gettingLocation ? 'Obteniendo...' : 'Usar Mi Ubicación'}
                  </Button>
                  <div className="flex gap-2 flex-1">
                    <div className="flex-1">
                      <Label htmlFor="latitude">Latitud</Label>
                      <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={locationForm.latitude}
                        onChange={(e) => setLocationForm({...locationForm, latitude: e.target.value})}
                        placeholder="25.7617"
                        required
                      />
                    </div>
                    <div className="flex-1">
                      <Label htmlFor="longitude">Longitud</Label>
                      <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={locationForm.longitude}
                        onChange={(e) => setLocationForm({...locationForm, longitude: e.target.value})}
                        placeholder="-80.1918"
                        required
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor="radius-location">Radio (km)</Label>
                    <Select value={locationForm.radius.toString()} onValueChange={(value) => setLocationForm({...locationForm, radius: parseInt(value)})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 km</SelectItem>
                        <SelectItem value="10">10 km</SelectItem>
                        <SelectItem value="25">25 km</SelectItem>
                        <SelectItem value="50">50 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Buscando...' : 'Buscar Tiendas'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="address" className="space-y-4">
              <form onSubmit={searchByAddress} className="space-y-4">
                <div>
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={addressForm.address}
                    onChange={(e) => setAddressForm({...addressForm, address: e.target.value})}
                    placeholder="1234 Main St, Miami, FL"
                    required
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor="radius-address">Radio (km)</Label>
                    <Select value={addressForm.radius.toString()} onValueChange={(value) => setAddressForm({...addressForm, radius: parseInt(value)})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 km</SelectItem>
                        <SelectItem value="10">10 km</SelectItem>
                        <SelectItem value="25">25 km</SelectItem>
                        <SelectItem value="50">50 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Buscando...' : 'Buscar Tiendas'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="zipcode" className="space-y-4">
              <form onSubmit={searchByZipCode} className="space-y-4">
                <div>
                  <Label htmlFor="zipcode">Código Postal</Label>
                  <Input
                    id="zipcode"
                    value={zipCodeForm.zipCode}
                    onChange={(e) => setZipCodeForm({...zipCodeForm, zipCode: e.target.value})}
                    placeholder="33101"
                    required
                  />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Label htmlFor="radius-zipcode">Radio (km)</Label>
                    <Select value={zipCodeForm.radius.toString()} onValueChange={(value) => setZipCodeForm({...zipCodeForm, radius: parseInt(value)})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 km</SelectItem>
                        <SelectItem value="10">10 km</SelectItem>
                        <SelectItem value="25">25 km</SelectItem>
                        <SelectItem value="50">50 km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Buscando...' : 'Buscar Tiendas'}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>

          {/* Filtros */}
          {Object.keys(filterOptions).length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros de Servicios
                </h3>
                {selectedFilters.length > 0 && (
                  <Button onClick={clearFilters} variant="ghost" size="sm">
                    Limpiar Filtros
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(filterOptions).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={selectedFilters.includes(key)}
                      onCheckedChange={(checked) => handleFilterChange(key, checked as boolean)}
                    />
                    <Label
                      htmlFor={key}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedFilters.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedFilters.map(filterId => (
                    <Badge key={filterId} variant="secondary" className="text-xs">
                      {filterOptions[filterId]}
                      <button
                        onClick={() => handleFilterChange(filterId, false)}
                        className="ml-2 text-xs hover:text-red-500"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultados */}
      {stores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tiendas Encontradas ({stores.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stores.map((store) => (
                <Card key={store.storeNumber} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{store.storeName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Tienda #{store.storeNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        {store.distance && (
                          <p className="text-sm font-medium text-blue-600">
                            {formatDistance(store.distance)}
                          </p>
                        )}
                        <Badge variant={store.isOpen ? "default" : "secondary"}>
                          {store.isOpen ? "Abierto" : "Cerrado"}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 mt-1 text-gray-500" />
                          <div>
                            <p className="text-sm">{formatAddress(store.address)}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-500" />
                          <p className="text-sm">{store.phone}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <Clock className="h-4 w-4 mt-1 text-gray-500" />
                          <div className="text-sm">
                            <p className="font-medium">Horarios:</p>
                            <div className="grid grid-cols-2 gap-1 mt-1">
                              {Object.entries(store.hours).slice(0, 3).map(([day, hours]) => (
                                <p key={day} className="text-xs">
                                  {getDayName(day)}: {hours}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {store.pharmacy && (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                          Farmacia Disponible
                        </h4>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {store.pharmacy.phone}
                          </div>
                        </div>
                      </div>
                    )}

                    {store.services.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Servicios Disponibles:</h4>
                        <div className="flex flex-wrap gap-1">
                          {store.services.slice(0, 6).map((service, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {service}
                            </Badge>
                          ))}
                          {store.services.length > 6 && (
                            <Badge variant="outline" className="text-xs">
                              +{store.services.length - 6} más
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Botón de asignación de tienda */}
                    {lookupData?.encLoyaltyId && (
                      <div className="mt-4 pt-3 border-t">
                        <Button
                          onClick={() => handleAssignStore(store)}
                          disabled={assigningStore === store.storeNumber}
                          className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                          {assigningStore === store.storeNumber 
                            ? "Asignando..." 
                            : "Seleccionar como mi tienda"
                          }
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}