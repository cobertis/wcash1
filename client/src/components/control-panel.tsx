import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import AdminShell from "@/components/admin/layout/AdminShell";
import { 
  Users, 
  Gift, 
  TrendingUp, 
  Activity, 
  Store, 
  Search, 
  Settings, 

  Calendar,
  DollarSign,
  ShoppingCart,
  Package,
  Menu,
  X,
  Home,
  FileText,
  Clock,
  Target,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  Loader2,
  Upload,
  Trash2,
  MapPin,
  Award,
  CreditCard,
  User,
  Eye,
  EyeOff,
  Edit,
  Star,
  Tag,
  Check,
  Zap,
  RefreshCw,
  Filter,
  Download,
  Key,
  Plus
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Toast removed - using console.log instead
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
// Toast removed - using console.log instead
import { useLocation } from "wouter";
import { JobExecutionHistory } from "./job-execution-history";
import BalanceRewardsSimple from "./balance-rewards-simple";
import Scanner from "@/pages/Scanner";

// Auto-Reset Status Component
function AutoResetStatus() {
  const [manualResetLoading, setManualResetLoading] = useState(false);

  // Get current Miami time info
  const getCurrentMiamiTime = () => {
    const now = new Date();
    const miamiTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    return miamiTime;
  };

  const getNextResetTime = () => {
    const miamiTime = getCurrentMiamiTime();
    const tomorrow = new Date(miamiTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const getHoursUntilReset = () => {
    const miamiTime = getCurrentMiamiTime();
    const nextReset = getNextResetTime();
    return Math.ceil((nextReset.getTime() - miamiTime.getTime()) / (1000 * 60 * 60));
  };

  const handleManualReset = async () => {
    setManualResetLoading(true);
    try {
      const response = await fetch('/api/member-history/reset-midnight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Manual reset completed: ${result.resetCount} accounts unmarked`);
        // Refresh dashboard stats after reset
        queryClient.invalidateQueries({ queryKey: ['/api/member-history/dashboard-stats'] });
      } else {
        console.error('❌ Reset failed:', result.message);
      }
    } catch (error) {
      console.error('❌ Reset error:', error);
    } finally {
      setManualResetLoading(false);
    }
  };

  const currentTime = getCurrentMiamiTime();
  const nextReset = getNextResetTime();
  const hoursUntilReset = getHoursUntilReset();
  const isResetTime = currentTime.getHours() === 0 && currentTime.getMinutes() < 30;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Sistema de Auto-Reset (Miami)
        </CardTitle>
        <CardDescription>
          Reseteo automático de cuentas marcadas cada día a medianoche (00:00-00:30)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Hora Actual (Miami)</div>
            <div className="font-mono text-lg">
              {currentTime.toLocaleString()}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm text-gray-600">Próximo Reset</div>
            <div className="font-mono text-lg">
              {nextReset.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
          <div>
            <div className="font-medium">Tiempo hasta próximo reset</div>
            <div className="text-lg font-bold text-blue-600">
              {hoursUntilReset} horas
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isResetTime ? (
              <Badge variant="destructive">Ventana de Reset Activa</Badge>
            ) : (
              <Badge variant="secondary">Auto-Reset Activo</Badge>
            )}
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Reset Manual</div>
              <div className="text-sm text-gray-600">
                Resetear todas las cuentas marcadas inmediatamente
              </div>
            </div>
            <Button 
              onClick={handleManualReset}
              disabled={manualResetLoading}
              variant="outline"
              className="flex items-center gap-2"
            >
              {manualResetLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reseteando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Reset Manual
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// API Key Pool Stats Component
function APIKeyPoolStats() {
  const [newApiKey, setNewApiKey] = useState('');
  const [newAffId, setNewAffId] = useState('');
  const [keyName, setKeyName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyName, setEditKeyName] = useState('');
  const [editApiKey, setEditApiKey] = useState('');
  const [editAffId, setEditAffId] = useState('');
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  
  // Bulk API Keys state
  const [bulkApiKeys, setBulkApiKeys] = useState('');
  const [bulkAffId, setBulkAffId] = useState('AAAAAAAAAA');
  const [showBulkInput, setShowBulkInput] = useState(true);
  
  // Toast removed - using console.log instead
  const queryClient = useQueryClient();

  const { data: poolStats, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/api-pool/stats'],
    queryFn: async () => {
      const response = await fetch('/api/api-pool/stats');
      if (!response.ok) throw new Error('Failed to fetch pool stats');
      return response.json();
    },
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const addApiKeyMutation = useMutation({
    mutationFn: async (keyData: { apiKey: string; affId: string; name: string }) => {
      const response = await fetch('/api/api-pool/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(keyData)
      });
      if (!response.ok) throw new Error('Failed to add API key');
      return response.json();
    },
    onSuccess: () => {
      console.log("✅ API Key agregada exitosamente al pool");
      setNewApiKey('');
      setNewAffId('');
      setKeyName('');
      setIsAdding(false);
      refetch();
    },
    onError: (error) => {
      console.log("Toast notification removed");
    }
  });

  const removeApiKeyMutation = useMutation({
    mutationFn: async (keyName: string) => {
      const response = await fetch(`/api/api-pool/remove/${keyName}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove API key');
      return response.json();
    },
    onSuccess: () => {
      console.log("Toast notification removed");
      refetch();
    },
    onError: (error) => {
      console.log("Toast notification removed");
    }
  });

  const testApiKeyMutation = useMutation({
    mutationFn: async (keyName: string) => {
      const response = await fetch(`/api/api-pool/test/${keyName}`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Failed to test API key');
      return response.json();
    },
    onSuccess: (data, keyName) => {
      console.log("Toast notification removed");
      setTestingKey(null);
      refetch();
    },
    onError: (error) => {
      console.log("Toast notification removed");
      setTestingKey(null);
    }
  });

  const editApiKeyMutation = useMutation({
    mutationFn: async (keyData: { keyName: string; newName?: string; apiKey: string; affId: string }) => {
      const response = await fetch(`/api/api-pool/edit/${keyData.keyName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          newName: keyData.newName,
          apiKey: keyData.apiKey, 
          affId: keyData.affId 
        })
      });
      if (!response.ok) throw new Error('Failed to edit API key');
      return response.json();
    },
    onSuccess: () => {
      console.log("Toast notification removed");
      setEditingKey(null);
      setEditKeyName('');
      setEditApiKey('');
      setEditAffId('');
      // Invalidate and refetch the API pool stats
      queryClient.invalidateQueries({ queryKey: ['/api/api-pool/stats'] });
      refetch();
    },
    onError: (error) => {
      console.log("Toast notification removed");
    }
  });

  const testApiKey = (keyName: string) => {
    setTestingKey(keyName);
    testApiKeyMutation.mutate(keyName);
  };

  const startEditing = (keyName: string, currentApiKey: string, currentAffId: string) => {
    setEditingKey(keyName);
    setEditKeyName(keyName);
    setEditApiKey(currentApiKey);
    setEditAffId(currentAffId);
  };

  const cancelEditing = () => {
    setEditingKey(null);
    setEditKeyName('');
    setEditApiKey('');
    setEditAffId('');
  };

  const handleEditApiKey = () => {
    if (!editApiKey.trim() || !editAffId.trim() || !editKeyName.trim()) {
      console.log("Toast notification removed");
      return;
    }
    editApiKeyMutation.mutate({
      keyName: editingKey!,
      newName: editKeyName.trim(),
      apiKey: editApiKey.trim(),
      affId: editAffId.trim()
    });
  };

  const toggleShowValues = (keyName: string) => {
    setShowValues(prev => ({
      ...prev,
      [keyName]: !prev[keyName]
    }));
  };

  const maskValue = (value: string, show: boolean) => {
    if (show) return value;
    return '*'.repeat(Math.min(value.length, 20));
  };

  const handleAddApiKey = () => {
    if (!newApiKey.trim() || !newAffId.trim() || !keyName.trim()) {
      console.log("Toast notification removed");
      return;
    }
    addApiKeyMutation.mutate({
      apiKey: newApiKey.trim(),
      affId: newAffId.trim(),
      name: keyName.trim()
    });
  };

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { apiKeys: string; affId: string }) => {
      const response = await fetch('/api/api-pool/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update API keys');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log(`✅ ${data.count} API keys actualizadas exitosamente`);
      setBulkApiKeys('');
      refetch();
    },
    onError: (error: Error) => {
      console.error('Error:', error.message);
    }
  });

  const handleBulkUpdate = () => {
    if (!bulkApiKeys.trim()) {
      console.error('Por favor ingresa al menos una API key');
      return;
    }
    if (!bulkAffId.trim()) {
      console.error('Por favor ingresa el Affiliate ID');
      return;
    }
    
    const lines = bulkApiKeys.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      console.error('No se encontraron API keys válidas');
      return;
    }
    
    bulkUpdateMutation.mutate({
      apiKeys: bulkApiKeys,
      affId: bulkAffId.trim()
    });
  };

  if (isLoading) return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Estadísticas del Pool de API Keys
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (error) return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error al cargar estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">{error.message}</p>
        </CardContent>
      </Card>
    </div>
  );

  const formatThroughput = (throughput: number) => {
    return `${throughput} requests/min`;
  };

  const calculateUsagePercentage = (current: number, max: number) => {
    return Math.round((current / max) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Pool Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            Resumen del Pool de API Keys
          </CardTitle>
          <CardDescription>
            Estado actual del sistema de múltiples API keys para incrementar el throughput
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{poolStats?.totalKeys ?? 0}</div>
              <div className="text-sm text-gray-600">API Keys Totales</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatThroughput(poolStats?.totalThroughput ?? 0)}
              </div>
              <div className="text-sm text-gray-600">Throughput Total</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {poolStats?.multipleKeysEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
              </div>
              <div className="text-sm text-gray-600">Múltiples Keys</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de 2 columnas para Estadísticas y Gestión */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Individual Key Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Estadísticas por API Key</CardTitle>
            <CardDescription>
              Uso individual de cada API key en el pool
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {poolStats?.poolStats?.map((keyStats: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{keyStats.name}</span>
                      {keyStats.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Circle className="h-2 w-2 fill-green-500 mr-1" />
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <Circle className="h-2 w-2 fill-red-500 mr-1" />
                          Inactiva
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {keyStats.requestCount}/{keyStats.maxRequests} requests
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Progress 
                      value={calculateUsagePercentage(keyStats.requestCount, keyStats.maxRequests)} 
                      className="h-2"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Uso: {calculateUsagePercentage(keyStats.requestCount, keyStats.maxRequests)}%</span>
                      {keyStats.lastResetTime && (
                        <span>Último reset: {new Date(keyStats.lastResetTime).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* API Key Management */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Gestión de API Keys
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setShowBulkInput(!showBulkInput);
                  setIsAdding(false);
                }}
                variant={showBulkInput ? "default" : "outline"}
                size="sm"
              >
                {showBulkInput ? '✅ Modo Masivo' : 'Modo Masivo'}
              </Button>
              <Button 
                onClick={() => {
                  setIsAdding(!isAdding);
                  setShowBulkInput(false);
                }}
                variant={isAdding ? "default" : "outline"}
                size="sm"
              >
                {isAdding ? '✅ Agregar Individual' : 'Agregar Individual'}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Pega todas tus API keys (una por línea) para máxima velocidad
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Bulk Input Mode */}
          {showBulkInput && (
            <div className="space-y-4 p-6 border-2 border-blue-200 rounded-lg bg-blue-50/50 mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Configuración Masiva - Máxima Velocidad</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="bulkAffId" className="text-blue-900 font-medium">
                    Affiliate ID (el mismo para todas las keys)
                  </Label>
                  <Input
                    id="bulkAffId"
                    placeholder="AAAAAAAAAA"
                    value={bulkAffId}
                    onChange={(e) => setBulkAffId(e.target.value)}
                    className="mt-1 bg-white"
                    data-testid="input-bulk-aff-id"
                  />
                </div>
                <div>
                  <Label htmlFor="bulkApiKeys" className="text-blue-900 font-medium mb-2 block">
                    API Keys (una por línea) - El sistema detectará automáticamente cuántas hay
                  </Label>
                  <textarea
                    id="bulkApiKeys"
                    placeholder="uu6AyeO7XCwo5moFWSrMJ6HHhKMQ2FZW&#10;NQpKJZXdhbI2KRbfApYXcvtcYHtxjyFW&#10;rTIthoVNMd81ZNE2KAuyZP5GB8HZzbsp&#10;..."
                    value={bulkApiKeys}
                    onChange={(e) => setBulkApiKeys(e.target.value)}
                    className="w-full h-64 p-3 border rounded-md font-mono text-sm bg-white resize-y"
                    data-testid="textarea-bulk-api-keys"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    {bulkApiKeys.split('\n').filter(line => line.trim()).length} API keys detectadas
                  </p>
                </div>
                <Button 
                  onClick={handleBulkUpdate}
                  disabled={bulkUpdateMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  data-testid="button-bulk-update"
                >
                  {bulkUpdateMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      Actualizando {bulkApiKeys.split('\n').filter(line => line.trim()).length} API Keys...
                    </>
                  ) : (
                    <>
                      <Zap className="h-5 w-5 mr-2" />
                      Actualizar {bulkApiKeys.split('\n').filter(line => line.trim()).length} API Keys
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-600 italic">
                  💡 Esto reemplazará TODAS las API keys existentes con las nuevas. El scanner se actualizará automáticamente.
                </p>
              </div>
            </div>
          )}
          
          {/* Individual Add Mode */}
          {isAdding && (
            <div className="space-y-4 p-4 border rounded-lg bg-gray-50 mb-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="keyName">Nombre de la Key</Label>
                  <Input
                    id="keyName"
                    placeholder="ej: API_KEY_2"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newApiKey">API Key</Label>
                  <Input
                    id="newApiKey"
                    placeholder="NQpKJZXdhb..."
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newAffId">Affiliate ID</Label>
                  <Input
                    id="newAffId"
                    placeholder="AAAAAAAAAA"
                    value={newAffId}
                    onChange={(e) => setNewAffId(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddApiKey}
                  disabled={addApiKeyMutation.isPending}
                >
                  {addApiKeyMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Agregando...
                    </>
                  ) : (
                    'Agregar API Key'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="space-y-3">
            {!poolStats?.poolStats || poolStats.poolStats.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed rounded-lg bg-gray-50">
                <div className="text-gray-400 mb-2">
                  <Key className="h-12 w-12 mx-auto mb-3" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">
                  No hay API Keys configuradas
                </h3>
                <p className="text-sm text-gray-500 mb-4">
                  Agrega tu primera API key de Walgreens para empezar a usar el sistema
                </p>
                <Button 
                  onClick={() => setIsAdding(true)}
                  variant="outline"
                  className="mx-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Primera API Key
                </Button>
              </div>
            ) : (
              poolStats.poolStats.map((keyStats: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {editingKey === keyStats.name ? (
                      <Input
                        value={editKeyName}
                        onChange={(e) => setEditKeyName(e.target.value)}
                        className="font-medium text-lg w-48"
                        placeholder="Nombre de la API Key"
                      />
                    ) : (
                      <span className="font-medium text-lg">{keyStats.name}</span>
                    )}
                    {keyStats.isActive ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <Circle className="h-2 w-2 fill-green-500 mr-1" />
                        Activa
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <Circle className="h-2 w-2 fill-red-500 mr-1" />
                        Inactiva
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleShowValues(keyStats.name)}
                    >
                      {showValues[keyStats.name] ? (
                        <>
                          <EyeOff className="h-4 w-4 mr-2" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4 mr-2" />
                          Ver
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testApiKey(keyStats.name)}
                      disabled={testApiKeyMutation.isPending}
                    >
                      {testApiKeyMutation.isPending && testingKey === keyStats.name ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Verificar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditing(keyStats.name, keyStats.apiKey || '', keyStats.affId || '')}
                      disabled={editingKey === keyStats.name}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeApiKeyMutation.mutate(keyStats.name)}
                      disabled={removeApiKeyMutation.isPending}
                      className="text-red-600 hover:text-red-700"
                    >
                      {removeApiKeyMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* API Key Values Display */}
                {showValues[keyStats.name] && (
                  <div className="mb-3 p-3 bg-gray-50 rounded text-sm space-y-2">
                    <div>
                      <span className="font-medium">API Key:</span>
                      <code className="ml-2 text-xs bg-white px-2 py-1 rounded border">
                        {keyStats.apiKey || 'No disponible'}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium">Affiliate ID:</span>
                      <code className="ml-2 text-xs bg-white px-2 py-1 rounded border">
                        {keyStats.affId || 'No disponible'}
                      </code>
                    </div>
                  </div>
                )}

                {/* Edit Form */}
                {editingKey === keyStats.name && (
                  <div className="mb-3 p-3 border rounded bg-blue-50 space-y-3">
                    <div>
                      <Label htmlFor={`edit-name-${keyStats.name}`}>Nombre de la API Key</Label>
                      <Input
                        id={`edit-name-${keyStats.name}`}
                        value={editKeyName}
                        onChange={(e) => setEditKeyName(e.target.value)}
                        placeholder="Mi API Key"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-api-key-${keyStats.name}`}>API Key</Label>
                      <Input
                        id={`edit-api-key-${keyStats.name}`}
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        placeholder="NQpKJZXdhb..."
                      />
                    </div>
                    <div>
                      <Label htmlFor={`edit-aff-id-${keyStats.name}`}>Affiliate ID</Label>
                      <Input
                        id={`edit-aff-id-${keyStats.name}`}
                        value={editAffId}
                        onChange={(e) => setEditAffId(e.target.value)}
                        placeholder="AAAAAAAAAA"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleEditApiKey}
                        disabled={editApiKeyMutation.isPending}
                        size="sm"
                      >
                        {editApiKeyMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Guardando...
                          </>
                        ) : (
                          'Guardar Cambios'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={cancelEditing}
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Uso: {keyStats.requestCount}/{keyStats.maxRequests} requests</span>
                    <span>{calculateUsagePercentage(keyStats.requestCount, keyStats.maxRequests)}%</span>
                  </div>
                  <Progress 
                    value={calculateUsagePercentage(keyStats.requestCount, keyStats.maxRequests)} 
                    className="h-2"
                  />
                  {keyStats.lastResetTime && (
                    <div className="text-xs text-gray-500">
                      Último reset: {new Date(keyStats.lastResetTime).toLocaleTimeString()}
                    </div>
                  )}
                  {keyStats.lastTestResult && (
                    <div className={`text-xs p-2 rounded ${
                      keyStats.lastTestResult.success 
                        ? 'bg-green-50 text-green-700' 
                        : 'bg-red-50 text-red-700'
                    }`}>
                      Última verificación: {keyStats.lastTestResult.success ? 'Exitosa' : 'Falló'} 
                      {keyStats.lastTestResult.message && ` - ${keyStats.lastTestResult.message}`}
                      <br />
                      <span className="text-xs opacity-75">
                        {new Date(keyStats.lastTestResult.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Límite por API Key:</span>
              <span className="font-medium">300 requests/minuto</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reset automático:</span>
              <span className="font-medium">Cada minuto</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rotación de keys:</span>
              <span className="font-medium">{poolStats?.multipleKeysEnabled ? 'Automática' : 'No disponible'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Última actualización:</span>
              <span className="font-medium">{new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>


    </div>
  );
}

// OffersSection component
function OffersSection({ encLoyaltyId }: { encLoyaltyId?: string }) {
  const [activeTab, setActiveTab] = useState('available');
  const [clippingOffer, setClippingOffer] = useState<string | null>(null);
  const [clippingAllOffers, setClippingAllOffers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOfferDetails, setSelectedOfferDetails] = useState<any>(null);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const ITEMS_PER_PAGE = 15;
  // Toast removed - using console.log instead
  
  // Format balance to always show .00 for whole numbers
  const formatBalance = (balance: number | string) => {
    if (typeof balance === 'string') {
      const num = parseFloat(balance);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    }
    return balance ? balance.toFixed(2) : '0.00';
  };

  const { data: availableData, isLoading: loadingAvailable, error: availableError } = useQuery({
    queryKey: [`/api/offers/${encLoyaltyId}/available/available`, activeTab],
    queryFn: async () => {
      try {
        console.log('🚀 FRONTEND: Fetching available offers for:', encLoyaltyId);
        const response = await fetch(`/api/offers/${encodeURIComponent(encLoyaltyId)}/available/available`);
        console.log('📡 FRONTEND: Response status:', response.status, response.statusText);
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ FRONTEND: Bad response:', errorText);
          throw new Error(`Failed to fetch available offers: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        console.log('✅ FRONTEND: Available offers response:', data);
        return data;
      } catch (error) {
        console.error('❌ FRONTEND: Available offers query error:', error);
        throw error;
      }
    },
    enabled: !!encLoyaltyId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: clippedData, isLoading: loadingClipped, error: clippedError } = useQuery({
    queryKey: [`/api/offers/${encLoyaltyId}/clipped/clipped`, activeTab],
    queryFn: async () => {
      console.log('🚀 FRONTEND: Fetching clipped offers for:', encLoyaltyId);
      const response = await fetch(`/api/offers/${encodeURIComponent(encLoyaltyId)}/clipped/clipped`);
      if (!response.ok) throw new Error('Failed to fetch clipped offers');
      const data = await response.json();
      console.log('✅ FRONTEND: Clipped offers response:', data);
      return data;
    },
    enabled: !!encLoyaltyId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: redeemedData, isLoading: loadingRedeemed, error: redeemedError } = useQuery({
    queryKey: [`/api/offers/${encLoyaltyId}/redeemed/redeemed`, activeTab],
    queryFn: async () => {
      console.log('🚀 FRONTEND: Fetching redeemed offers for:', encLoyaltyId);
      const response = await fetch(`/api/offers/${encodeURIComponent(encLoyaltyId)}/redeemed/redeemed`);
      if (!response.ok) throw new Error('Failed to fetch redeemed offers');
      const data = await response.json();
      console.log('✅ FRONTEND: Redeemed offers response:', data);
      return data;
    },
    enabled: !!encLoyaltyId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Extract offers from API response - use exactly what the API provides
  const availableOffers = availableData?.offers || [];
  const clippedOffers = clippedData?.offers || [];
  const redeemedOffers = redeemedData?.offers || [];

  // Tab change handler that forces refresh
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setCurrentPage(1);
    // Force query refresh when changing tabs
    queryClient.invalidateQueries({ 
      queryKey: [`/api/offers/${encLoyaltyId}/${newTab}/${newTab}`] 
    });
  };

  // Debug logging with error information
  console.log('🔍 Frontend debug:', {
    activeTab,
    encLoyaltyId,
    availableData,
    availableDataType: typeof availableData,
    availableDataOffers: availableData?.offers,
    availableDataOffersLength: availableData?.offers?.length,
    availableOffers,
    availableOffersLength: availableOffers.length,
    availableOffersType: typeof availableOffers,
    loadingAvailable,
    queryEnabled: !!encLoyaltyId && activeTab === 'available',
    availableError: availableError?.message,
    rawAvailableData: JSON.stringify(availableData, null, 2)
  });

  const clipOfferMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const response = await fetch(`/api/offers/${encodeURIComponent(encLoyaltyId)}/clip/${offerId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to clip offer');
      }
      return response.json();
    },
    onSuccess: () => {
      console.log("Toast notification removed");
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${encLoyaltyId}/available`] });
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${encLoyaltyId}/clipped`] });
    },
    onError: (error: any) => {
      let errorMessage = "No se pudo agregar la oferta a tu cuenta";
      
      // Check if it's a temporary API error
      if (error.message && error.message.includes("cannot clip at this time")) {
        errorMessage = "El servicio de Walgreens está temporalmente no disponible. Intenta nuevamente en unos minutos.";
      } else if (error.message && error.message.includes("already clipped")) {
        errorMessage = "Esta oferta ya ha sido agregada a tu cuenta anteriormente.";
      } else if (error.message && error.message !== "Failed to clip offer") {
        errorMessage = error.message;
      }
      
      console.log("Toast notification removed");
    },
    onSettled: () => {
      setClippingOffer(null);
    },
  });

  const handleClipOffer = (offerId: string) => {
    setClippingOffer(offerId);
    clipOfferMutation.mutate(offerId);
  };

  const handleClipAllOffers = async () => {
    if (!availableData?.offers || availableData.offers.length === 0) {
      console.log("Toast notification removed");
      return;
    }

    setClippingAllOffers(true);
    let successCount = 0;
    let failCount = 0;
    const totalOffers = availableData.offers.length;

      console.log("Toast notification removed");

    try {
      for (let i = 0; i < availableData.offers.length; i++) {
        const offer = availableData.offers[i];
        
        try {
          // Rate limiting: 200ms delay between requests (300 requests/minute)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          const response = await fetch(`/api/offers/${encodeURIComponent(encLoyaltyId)}/clip/${offer.offerId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (response.ok) {
            successCount++;
            console.log(`✅ Clipped offer ${i + 1}/${totalOffers}: ${offer.title}`);
          } else {
            failCount++;
            console.log(`❌ Failed to clip offer ${i + 1}/${totalOffers}: ${offer.title}`);
          }
        } catch (error) {
          failCount++;
          console.log(`❌ Error clipping offer ${i + 1}/${totalOffers}: ${offer.title}`, error);
        }

        // Progress update every 10 offers
        if ((i + 1) % 10 === 0) {
      console.log("Toast notification removed");
        }
      }

      // Final result
      console.log("Toast notification removed");

      // Invalidate cache to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${encLoyaltyId}/available`] });
      queryClient.invalidateQueries({ queryKey: [`/api/offers/${encLoyaltyId}/clipped`] });

    } catch (error) {
      console.log("Toast notification removed");
    } finally {
      setClippingAllOffers(false);
    }
  };



  // Filter offers based on search term
  const filterOffers = (offers: any[]) => {
    if (!searchTerm.trim()) return offers;
    
    const term = searchTerm.toLowerCase();
    return offers.filter(offer => 
      (offer.title && offer.title.toLowerCase().includes(term)) ||
      (offer.brandName && offer.brandName.toLowerCase().includes(term)) ||
      (offer.description && offer.description.toLowerCase().includes(term)) ||
      (offer.categoryName && offer.categoryName.toLowerCase().includes(term))
    );
  };

  const getPaginatedOffers = (offers: any[]) => {
    const filteredOffers = filterOffers(offers);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredOffers.slice(startIndex, endIndex);
  };

  const getTotalPages = (offers: any[]) => {
    const filteredOffers = filterOffers(offers);
    return Math.ceil(filteredOffers.length / ITEMS_PER_PAGE);
  };

  const getFilteredCount = (offers: any[]) => {
    return filterOffers(offers).length;
  };

  const renderOfferCard = (offer: any) => {
    const isClipping = clippingOffer === offer.offerId;
    const isClipped = activeTab === 'clipped';
    const isRedeemed = activeTab === 'redeemed';
    
    // Format expiry date
    const formatExpiryDate = (dateStr: string) => {
      if (!dateStr) return 'Expires soon';
      try {
        const date = new Date(dateStr);
        return `Expires ${date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })}`;
      } catch {
        return 'Expires soon';
      }
    };
    
    return (
      <div key={offer.offerId} className="bg-white rounded-lg shadow-md p-4 border border-gray-200 hover:shadow-lg transition-shadow">
        {/* Header with validity/expiry */}
        <div className="text-xs text-gray-500 mb-2">
          {formatExpiryDate(offer.expiryDate)}
        </div>

        {/* Discount amount */}
        <div className="text-red-600 font-bold text-lg mb-1">
          {offer.discount || offer.summary || '$1 off'}
        </div>

        {/* Product image and details */}
        <div className="flex items-start gap-3 mb-3">
          {offer.imageUrl ? (
            <img 
              src={offer.imageUrl} 
              alt={offer.title || offer.brandName}
              className="w-16 h-16 object-contain rounded bg-gray-50"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          
          <div className={`w-16 h-16 bg-gray-100 rounded flex items-center justify-center ${offer.imageUrl ? 'hidden' : ''}`}>
            <Tag className="w-8 h-8 text-gray-400" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 text-sm leading-tight mb-1">
              {offer.title || offer.brandName || 'Special Offer'}
            </h3>
            <p className="text-xs text-gray-600 line-clamp-2">
              {offer.description || 'Special offer available'}
            </p>
          </div>
        </div>

        {/* View details link */}
        <div className="text-center mb-3">
          <button 
            onClick={() => setSelectedOfferDetails(offer)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            View details
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          {!isClipped && !isRedeemed && (
            <Button
              onClick={() => handleClipOffer(offer.offerId)}
              disabled={isClipping}
              className="flex-1 bg-red-700 hover:bg-red-800 text-white text-sm py-2 px-4 rounded-full"
            >
              {isClipping ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Clipping...
                </>
              ) : (
                'Clip'
              )}
            </Button>
          )}
          
          {isClipped && (
            <Button
              disabled
              className="flex-1 bg-green-100 text-green-800 text-sm py-2 px-4 rounded-full"
            >
              ✓ Clipped
            </Button>
          )}
          
          {isRedeemed && (
            <Button
              disabled
              className="flex-1 bg-green-100 text-green-800 text-sm py-2 px-4 rounded-full"
            >
              ✓ Redeemed
            </Button>
          )}
          
          <Button
            variant="outline"
            className="flex-1 text-gray-700 border-gray-300 hover:bg-gray-50 text-sm py-2 px-4 rounded-full"
            onClick={() => window.open('https://www.walgreens.com', '_blank')}
          >
            Shop
          </Button>
        </div>


      </div>
    );
  };

  if (!encLoyaltyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Ofertas Disponibles</CardTitle>
          <CardDescription>
            Selecciona una cuenta para ver las ofertas disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Gift className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">
              No hay cuenta seleccionada
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-base sm:text-lg">Ofertas Disponibles</CardTitle>
            <CardDescription>
              Ofertas y cupones de la API de Walgreens
            </CardDescription>
          </div>
          {activeTab === 'available' && availableData?.offers && availableData.offers.length > 0 && (
            <Button
              onClick={() => handleClipAllOffers()}
              disabled={clippingAllOffers}
              variant="outline"
              size="sm"
              className="ml-4"
            >
              {clippingAllOffers ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Clipping...
                </>
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-2" />
                  Clip Todas
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeTab === 'available' ? 'default' : 'outline'}
            onClick={() => handleTabChange('available')}
            className="flex-1 text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
          >
            Disponibles ({availableOffers.length})
          </Button>
          <Button
            variant={activeTab === 'clipped' ? 'default' : 'outline'}
            onClick={() => handleTabChange('clipped')}
            className="flex-1 text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
          >
            Clipped ({clippedOffers.length})
          </Button>
          <Button
            variant={activeTab === 'redeemed' ? 'default' : 'outline'}
            onClick={() => handleTabChange('redeemed')}
            className="flex-1 text-xs sm:text-sm px-2 sm:px-4 py-1 sm:py-2"
          >
            Redeemed ({redeemedOffers.length})
          </Button>
        </div>

        {/* Search Field */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              type="text"
              placeholder="Buscar ofertas por nombre, marca o categoría..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page when searching
              }}
              className="pl-10 pr-4 py-2 w-full"
            />
          </div>
        </div>

        {/* Loading state */}
        {(loadingAvailable || loadingClipped || loadingRedeemed) && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-gray-400 mb-4" />
            <p className="text-gray-500">Cargando ofertas...</p>
          </div>
        )}

        {/* Available offers */}
        {activeTab === 'available' && !loadingAvailable && (
          <div>
            {availableData?.offers && availableData.offers.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {searchTerm ? (
                    <>
                      Mostrando {Math.min(ITEMS_PER_PAGE, getFilteredCount(availableData.offers) - (currentPage - 1) * ITEMS_PER_PAGE)} de {getFilteredCount(availableData.offers)} ofertas filtradas
                      <span className="text-gray-400 ml-2">({availableData.offers.length} total)</span>
                    </>
                  ) : (
                    <>
                      Mostrando {Math.min(ITEMS_PER_PAGE, availableData.offers.length - (currentPage - 1) * ITEMS_PER_PAGE)} de {availableData.offers.length} ofertas disponibles
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getPaginatedOffers(availableData.offers).map((offer: any) => renderOfferCard(offer))}
                </div>
                {getTotalPages(availableData.offers) > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {getTotalPages(availableData.offers)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(getTotalPages(availableData.offers), prev + 1))}
                      disabled={currentPage === getTotalPages(availableData.offers)}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Gift className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay ofertas disponibles</p>
              </div>
            )}
          </div>
        )}

        {/* Clipped offers */}
        {activeTab === 'clipped' && !loadingClipped && (
          <div>
            {clippedData?.offers && clippedData.offers.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {searchTerm ? (
                    <>
                      Mostrando {Math.min(ITEMS_PER_PAGE, getFilteredCount(clippedData.offers) - (currentPage - 1) * ITEMS_PER_PAGE)} de {getFilteredCount(clippedData.offers)} ofertas filtradas
                      <span className="text-gray-400 ml-2">({clippedData.offers.length} total)</span>
                    </>
                  ) : (
                    <>
                      Mostrando {Math.min(ITEMS_PER_PAGE, clippedData.offers.length - (currentPage - 1) * ITEMS_PER_PAGE)} de {clippedData.offers.length} ofertas clipped
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getPaginatedOffers(clippedData.offers).map((offer: any) => renderOfferCard(offer))}
                </div>
                {getTotalPages(clippedData.offers) > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {getTotalPages(clippedData.offers)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(getTotalPages(clippedData.offers), prev + 1))}
                      disabled={currentPage === getTotalPages(clippedData.offers)}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Gift className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay ofertas clipped</p>
              </div>
            )}
          </div>
        )}

        {/* Redeemed offers */}
        {activeTab === 'redeemed' && !loadingRedeemed && (
          <div>
            {redeemedData?.offers && redeemedData.offers.length > 0 ? (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {searchTerm ? (
                    <>
                      Mostrando {Math.min(ITEMS_PER_PAGE, getFilteredCount(redeemedData.offers) - (currentPage - 1) * ITEMS_PER_PAGE)} de {getFilteredCount(redeemedData.offers)} ofertas filtradas
                      <span className="text-gray-400 ml-2">({redeemedData.offers.length} total)</span>
                    </>
                  ) : (
                    <>
                      Mostrando {Math.min(ITEMS_PER_PAGE, redeemedData.offers.length - (currentPage - 1) * ITEMS_PER_PAGE)} de {redeemedData.offers.length} ofertas redeemed
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getPaginatedOffers(redeemedData.offers).map((offer: any) => renderOfferCard(offer))}
                </div>
                {getTotalPages(redeemedData.offers) > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {currentPage} de {getTotalPages(redeemedData.offers)}
                    </span>
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(prev => Math.min(getTotalPages(redeemedData.offers), prev + 1))}
                      disabled={currentPage === getTotalPages(redeemedData.offers)}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <Gift className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No hay ofertas redeemed</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {/* Details Modal */}
      <Dialog open={!!selectedOfferDetails} onOpenChange={() => setSelectedOfferDetails(null)}>
        <DialogContent className={`${enlargedImage ? 'max-w-5xl' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto transition-all duration-300`}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {selectedOfferDetails?.title || 'Detalles de la Oferta'}
            </DialogTitle>
            <DialogDescription>
              Información completa del cupón
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedOfferDetails && (
              <>
                {/* Discount Amount */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-800 mb-2">Descuento</h3>
                  <p className="text-2xl font-bold text-red-600">
                    {selectedOfferDetails.discount}
                  </p>
                </div>
                
                {/* Product Image */}
                {selectedOfferDetails.imageUrl && (
                  <div className="text-center">
                    {enlargedImage ? (
                      // Enlarged image view
                      <div className="w-full">
                        <img 
                          src={selectedOfferDetails.imageUrl} 
                          alt={selectedOfferDetails.title}
                          className="w-full h-auto max-h-[70vh] object-contain rounded-lg shadow-lg cursor-pointer bg-white p-4 border"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          onClick={() => setEnlargedImage(null)}
                        />
                        <div className="mt-4 flex justify-center">
                          <Button 
                            onClick={() => setEnlargedImage(null)}
                            variant="outline"
                            size="sm"
                            className="bg-white hover:bg-gray-100"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver tamaño normal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Small image view
                      <div className="relative inline-block group">
                        <img 
                          src={selectedOfferDetails.imageUrl} 
                          alt={selectedOfferDetails.title}
                          className="max-w-full h-auto max-h-48 mx-auto rounded-lg shadow-md cursor-pointer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          onClick={() => setEnlargedImage(selectedOfferDetails.imageUrl)}
                        />
                        <div 
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black bg-opacity-50 rounded-lg cursor-pointer"
                          onClick={() => setEnlargedImage(selectedOfferDetails.imageUrl)}
                        >
                          <Eye className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Brand and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-700 mb-1">Marca</h4>
                    <p className="text-gray-600">{selectedOfferDetails.brandName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <h4 className="font-semibold text-gray-700 mb-1">Categoría</h4>
                    <p className="text-gray-600">{selectedOfferDetails.categoryName}</p>
                  </div>
                </div>
                
                {/* Description */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">Descripción</h3>
                  <p className="text-blue-700">{selectedOfferDetails.description}</p>
                </div>
                
                {/* Expiry Date */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-800 mb-2">Fecha de Expiración</h3>
                  <p className="text-yellow-700">
                    {selectedOfferDetails.expiryDate ? 
                      new Date(selectedOfferDetails.expiryDate).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 
                      'No especificada'
                    }
                  </p>
                </div>
                
                {/* Offer ID */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="font-semibold text-gray-700 mb-1">ID de Oferta</h4>
                  <p className="text-xs text-gray-500 font-mono">{selectedOfferDetails.offerId}</p>
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              onClick={() => setSelectedOfferDetails(null)}
              variant="outline"
            >
              Cerrar
            </Button>
            <Button 
              onClick={() => window.open('https://www.walgreens.com', '_blank')}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              Ir a Walgreens
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </Card>
  );
}

export default function ControlPanel() {
  const [location, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMember, setLoadingMember] = useState<string | null>(null);
  const [markingMember, setMarkingMember] = useState<string | null>(null);
  const [markedAccounts, setMarkedAccounts] = useState<Set<string>>(new Set());
  const [markedAccountsLoaded, setMarkedAccountsLoaded] = useState<boolean>(false);
  const [autoMarkingToday, setAutoMarkingToday] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState<Set<string>>(new Set());
  const [updatingAccounts, setUpdatingAccounts] = useState<Set<string>>(new Set());
  const [globalUpdateInProgress, setGlobalUpdateInProgress] = useState(false);
  const [currentlyUpdatingAccount, setCurrentlyUpdatingAccount] = useState<string | null>(null);
  const [globalUpdateProgress, setGlobalUpdateProgress] = useState({ current: 0, total: 0 });
  const [updatingCategory, setUpdatingCategory] = useState<string | null>(null);
  const [updatedBalances, setUpdatedBalances] = useState<Record<string, { balance: string, lastActivity?: string }>>({});

  // Local filter states
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [localDateFilter, setLocalDateFilter] = useState("all");
  
  // Search input ref to maintain focus
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Debounce search term to prevent blocking during typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(localSearchTerm);
    }, 300); // 300ms delay
    
    return () => clearTimeout(timer);
  }, [localSearchTerm]);
  
  // Maintain focus on search input after render
  // TEMPORARILY DISABLED to debug app crash
  // useEffect(() => {
  //   if (localSearchTerm && searchInputRef.current) {
  //     // Restore focus if we have a search term and the input exists
  //     const activeElement = document.activeElement;
  //     if (activeElement !== searchInputRef.current) {
  //       // Only restore focus if it's not already focused
  //       searchInputRef.current.focus();
  //       // Set cursor position to end
  //       const len = searchInputRef.current.value.length;
  //       searchInputRef.current.setSelectionRange(len, len);
  //     }
  //   }
  // }, [localSearchTerm]);
  
  // WebSocket state for real-time updates
  const [wsConnection, setWsConnection] = useState<WebSocket | null>(null);
  const [realtimeUpdates, setRealtimeUpdates] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [historyPageIndex, setHistoryPageIndex] = useState(1);
  const [tempPageInput, setTempPageInput] = useState('1'); // Temporary state for page input

  // Sync temporary input with actual page index
  useEffect(() => {
    setTempPageInput(historyPageIndex.toString());
  }, [historyPageIndex]);

  // Handle page navigation with Enter key or blur
  const handlePageNavigation = (inputValue: string, totalPages: number) => {
    const page = parseInt(inputValue);
    if (page >= 1 && page <= totalPages) {
      console.log(`🔥 PAGINATION: Navigating to page ${page} after Enter/blur`);
      setHistoryPageIndex(page);
    } else {
      // Reset to current page if invalid
      setTempPageInput(historyPageIndex.toString());
    }
  };
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [clientMenuActive, setClientMenuActive] = useState('overview');
  // Toast removed - using console.log instead

  // Hydrate selectedMember from sessionStorage when navigating directly to /member/:phone
  useEffect(() => {
    // Only hydrate if we're on a member route and selectedMember is not already set
    if ((location.includes('/member/') || location.includes('/admin/member/')) && !selectedMember) {
      console.log('🔄 Attempting to hydrate member data from sessionStorage for:', location);
      
      // Try new sessionStorage format first
      const memberDataStr = sessionStorage.getItem('memberData');
      const memberPhone = sessionStorage.getItem('memberPhone');
      
      if (memberDataStr && memberPhone) {
        try {
          const data = JSON.parse(memberDataStr);
          console.log('✅ Found member data in sessionStorage:', data);
          
          // Create dashboard data structure matching what handleMemberClick does
          const dashboardData = {
            memberData: data.rawMemberData,
            lookupData: data.rawLookupData,
            profile: data.profile,
            encLoyaltyId: data.encLoyaltyId,
            phoneNumber: memberPhone,
            isFreshData: true
          };
          
          setSelectedMember(dashboardData);
          setClientMenuActive('overview');
          console.log('✅ Hydrated selectedMember from sessionStorage');
        } catch (error) {
          console.error('❌ Error parsing memberData from sessionStorage:', error);
        }
      } else {
        console.log('⚠️ No member data found in sessionStorage');
      }
    }
  }, [location, selectedMember]);
  
  const [isScanning, setIsScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Job progress modal
  const [progressModal, setProgressModal] = useState({
    isOpen: false,
    processed: 0,
    total: 0,
    added: 0,
    skipped: 0,
    message: '',
    isComplete: false
  });
  
  // Format balance to always show .00 for whole numbers
  const formatBalance = (balance: number | string) => {
    if (typeof balance === 'string') {
      const num = parseFloat(balance);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    }
    return balance ? balance.toFixed(2) : '0.00';
  };

  // NUEVO SISTEMA DE FILTRO - COMPLETAMENTE REESCRITO CON DEBOUNCE
  const filterLocalAccounts = (accounts: any[]) => {
    if (!accounts || accounts.length === 0) return [];
    
    // Si no hay término de búsqueda, devolver todos
    if (!debouncedSearchTerm.trim()) {
      return accounts;
    }

    const searchTerm = debouncedSearchTerm.trim().toLowerCase();
    console.log(`🔄 NEW FILTER SYSTEM: Searching for "${searchTerm}" in ${accounts.length} accounts`);
    
    // NUEVA LÓGICA: Filtro simple y directo
    const filtered = [];
    let nameMatches = 0;
    let phoneMatches = 0;
    
    for (const account of accounts) {
      const name = (account.memberName || account.member_name || '').toLowerCase();
      const phone = (account.phoneNumber || account.phone_number || '').toString();
      
      // Buscar en nombre (case insensitive)
      const nameFound = name.includes(searchTerm);
      
      // Buscar en teléfono (solo dígitos)
      const searchDigits = searchTerm.replace(/\D/g, '');
      const phoneFound = searchDigits.length > 0 && phone.includes(searchDigits);
      
      if (nameFound || phoneFound) {
        filtered.push(account);
        if (nameFound) nameMatches++;
        if (phoneFound) phoneMatches++;
        
        // Debug para casos específicos
        if (name.includes('tracy') || name.includes('connie')) {
          console.log(`✅ MATCH FOUND:`, {
            name,
            phone,
            searchTerm,
            nameFound,
            phoneFound
          });
        }
      }
    }
    
    console.log(`✅ NEW FILTER COMPLETE:`, {
      originalCount: accounts.length,
      filteredCount: filtered.length,
      nameMatches,
      phoneMatches,
      searchTerm,
      firstResults: filtered.slice(0, 3).map(a => ({
        name: a.memberName || a.member_name,
        phone: a.phoneNumber || a.phone_number
      }))
    });
    
    // Apply date filter if needed
    if (localDateFilter !== 'all') {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
      
      const dateFiltered = [];
      for (const account of filtered) {
        const lastActivity = account.lastActivityDate || account.last_activity_date || account.lastAccessedAt || account.last_accessed_at;
        if (!lastActivity) continue;

        const activityDate = new Date(lastActivity);
        const activityDateStr = activityDate.toISOString().split('T')[0];

        let includeByDate = false;
        switch (localDateFilter) {
          case 'today':
            includeByDate = activityDateStr === todayStr;
            break;
          case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            includeByDate = activityDateStr === yesterdayStr;
            break;
          case 'this_week':
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            includeByDate = activityDate >= startOfWeek;
            break;
          case 'this_month':
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            includeByDate = activityDate >= startOfMonth;
            break;
          default:
            includeByDate = true;
        }
        
        if (includeByDate) {
          dateFiltered.push(account);
        }
      }
      
      console.log(`📅 DATE FILTER APPLIED: ${filtered.length} → ${dateFiltered.length} accounts`);
      return dateFiltered;
    }

    return filtered;
  };
  
  // Determine current tab from URL
  const currentTab = (() => {
    const pathParts = location.split('/');
    const path = pathParts.pop() || 'dashboard';
    // If user is on /admin, show dashboard content
    if (path === 'admin' || path === 'dashboard') {
      return 'dashboard';
    }
    // Check if we're in accounts with phone number
    if (pathParts.includes('accounts') && pathParts.length >= 3) {
      return 'accounts';
    }
    // Handle all account segments
    if (path === 'accounts-50-plus' || path === 'accounts-20-plus' || 
        path === 'accounts-10-plus' || path === 'accounts-5-plus' || 
        path === 'new-accounts') {
      return path;
    }
    return path;
  })();

  // REMOVED: Excessive dashboard loading that was causing initial delay

  // Auto-load account from URL if on /admin/accounts/:phoneNumber
  useEffect(() => {
    const pathParts = location.split('/');
    if (pathParts.includes('accounts') && pathParts.length >= 4) {
      const phoneNumber = pathParts[pathParts.length - 1];
      if (phoneNumber && (phoneNumber.length === 10 || phoneNumber.length === 11) && !selectedMember) {
        // Auto-load this account
        handleMemberSearch(phoneNumber);
      }
    }
  }, [location, selectedMember]);

  // Clear selected member when changing tabs to show lists (OPTIMIZED)
  useEffect(() => {
    // Don't clear selectedMember if we're on a member detail route
    const isMemberRoute = location.includes('/admin/accounts/') || location.includes('/member/');
    
    if (currentTab && currentTab !== 'search' && !isMemberRoute) {
      setSelectedMember(null);
      // REMOVED: Excessive cache invalidation that was causing 6+ second delays
    }
    
    // Don't cancel bulk updates when changing tabs - let them continue in background
    // The user will see the persistent progress indicator at the top of the screen
    console.log(`📍 TAB CHANGE: User navigated to ${currentTab}, bulk update continues if active`);
  }, [currentTab, location, globalUpdateInProgress]);

  const handleMemberSearch = async (phoneNumberOrEvent: string | React.FormEvent) => {
    let phoneNumber: string;
    
    if (typeof phoneNumberOrEvent === 'string') {
      phoneNumber = phoneNumberOrEvent;
    } else {
      phoneNumberOrEvent.preventDefault();
      if (!searchTerm.trim()) return;
      phoneNumber = searchTerm.replace(/\D/g, '');
    }
    
    // Validate phone number length
    if (phoneNumber.length !== 10) {
      console.log("Toast notification removed");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Invalidate all offer-related cache before making fresh API call
      await queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey as string[];
        return key.some(k => typeof k === 'string' && (
          k.includes('/api/offers') || 
          k.includes('/api/clipped') || 
          k.includes('/api/redeemed') ||
          k.includes('offer-stats')
        ));
      }});
      
      // Use live Walgreens API as primary source
      console.log('🔴 CONSULTING LIVE WALGREENS API for:', phoneNumber);
      let response = await fetch('/api/lookup-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      // If live API fails, fallback to local data
      if (!response.ok) {
        console.log('🔄 Live API failed, trying cached data...');
        response = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber })
        });
      }
      
      if (!response.ok) {
        throw new Error('Member not found in live or local data');
      }
      
      const data = await response.json();
      
      // Store in sessionStorage for compatibility
      sessionStorage.setItem('memberData', JSON.stringify(data));
      sessionStorage.setItem('memberPhone', phoneNumber);
      
      // FORCE FRESH DATA: Always use fresh API data, never cached
      const dashboardData = {
        memberData: data.rawMemberData,
        lookupData: data.rawLookupData,
        encLoyaltyId: data.encLoyaltyId,
        profile: data.profile,
        phoneNumber: phoneNumber, // Add phone number for marking functionality
        isFreshData: true // Flag to force fresh data usage
      };
      
      // Set selected member for display in control panel
      setSelectedMember(dashboardData);
      setClientMenuActive('overview');
      
      // Update URL to accounts with phone number
      navigate(`/admin/accounts/${phoneNumber}`);
      
      console.log("Toast notification removed");
    } catch (error) {
      console.log("Toast notification removed");
    } finally {
      setIsLoading(false);
    }
  };
  
  // OPTIMIZED: Get specific category data only when needed - no more loading all 30,000 accounts!
  const getCategoryEndpoint = (tab: string) => {
    switch (tab) {
      case 'accounts':
      case 'accounts-100-plus':
        return '/api/member-history/accounts-100-plus';
      case 'accounts-50-plus':
        return '/api/member-history/accounts-50-plus';
      case 'accounts-20-plus':
        return '/api/member-history/accounts-20-plus';
      case 'accounts-10-plus':
        return '/api/member-history/accounts-10-plus';
      case 'accounts-5-plus':
        return '/api/member-history/accounts-5-plus';
      case 'new-accounts':
        return '/api/member-history/new-accounts';
      case 'all-accounts':
        return '/api/member-history/all-accounts';
      default:
        return null;
    }
  };

  // Only load specific category data when viewing account sections
  const { data: categoryData, isLoading: isLoadingCategory } = useQuery({
    queryKey: ['/api/category-data', currentTab, debouncedSearchTerm, localDateFilter],
    queryFn: async () => {
      const endpoint = getCategoryEndpoint(currentTab);
      if (!endpoint) {
        console.log('🚀 No category endpoint needed for tab:', currentTab);
        return [];
      }

      // When filters are active, get ALL data for filtering
      const hasFilters = debouncedSearchTerm.trim() || localDateFilter !== 'all';
      const size = hasFilters ? 999999 : 25;
      const page = hasFilters ? 1 : historyPageIndex;

      console.log(`🎯 OPTIMIZED: Loading ${hasFilters ? 'ALL' : '25'} ${currentTab} data from:`, endpoint, hasFilters ? '(filters active)' : '');
      const response = await fetch(`${endpoint}?page=${page}&size=${size}`);
      
      if (!response.ok) {
        throw new Error(`Category endpoint failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ OPTIMIZED: Loaded ${data?.data?.length || 0} accounts for ${currentTab} ${hasFilters ? '(all data for filtering)' : 'instantly'}`);
      
      return data.data || [];
    },
    enabled: !!getCategoryEndpoint(currentTab), // Only run when there's a valid endpoint
    staleTime: 0, // Always fresh data when filters change
    refetchOnWindowFocus: false,
  });

  // Recent Activity Query - Get latest 10 accounts accessed
  const { data: recentActivity, isLoading: isLoadingRecent } = useQuery({
    queryKey: ['/api/member-history/recent-activity'],
    queryFn: async () => {
      console.log('📊 Fetching recent activity for dashboard...');
      const response = await fetch('/api/member-history?limit=10&page=1');
      if (!response.ok) {
        console.error('Failed to fetch recent activity');
        return [];
      }
      const result = await response.json();
      const data = Array.isArray(result) ? result : (result.data || []);
      console.log('📊 Recent activity loaded:', data?.length || 0, 'accounts');
      return data;
    },
    staleTime: 30000,
    refetchInterval: 120000, // PRODUCTION: Refresh every 2 minutes instead of 1 minute
  });

  // Legacy memberHistory for backward compatibility (use categoryData when available, recentActivity for dashboard)
  const memberHistory = categoryData || recentActivity || [];
  const isLoadingHistory = isLoadingCategory || isLoadingRecent;

  // NEW: Ultra-fast sidebar counters query (separate from main data) - PRODUCTION FIX
  const { data: sidebarCounters, isLoading: isLoadingSidebar } = useQuery({
    queryKey: ['/api/member-history/sidebar-counters'],
    queryFn: async () => {
      const isProduction = window.location.hostname === 'wcash.replit.app';
      console.log('⚡ Fetching ultra-fast sidebar counters (Production mode:', isProduction, ')...');
      
      try {
        const response = await fetch('/api/member-history/sidebar-counters');
        if (!response.ok) {
          throw new Error('Primary sidebar endpoint failed');
        }
        const data = await response.json();
        console.log('⚡ Sidebar counters loaded:', data);
        return data;
      } catch (error) {
        console.log('⚡ Primary sidebar endpoint failed, using zero fallback to avoid loading all data');
        // OPTIMIZED: Don't fallback to loading all memberHistory - just return zeros
        return {
          accounts100Plus: 0,
          accounts50Plus: 0,
          accounts20Plus: 0,
          accounts10Plus: 0,
          accounts5Plus: 0,
          newAccounts: 0,
          total: 0
        };
      }
    },
    refetchInterval: 30000, // PRODUCTION: Update every 30 seconds instead of 5 seconds
    staleTime: 15000, // Cache for 15 seconds to reduce load
    retry: 1, // Only 1 retry to avoid overwhelming server
    refetchOnWindowFocus: false, // DISABLED: Don't refetch on window focus - reduces load
    refetchOnReconnect: false, // DISABLED: Don't refetch on reconnect - reduces load
  });

  // NEW: Dashboard statistics query using working endpoint
  const { data: dashboardStats, isLoading: isLoadingDashboardStats } = useQuery({
    queryKey: ['/api/member-history/dashboard-stats'],
    queryFn: async () => {
      console.log('📊 Fetching dashboard statistics...');
      try {
        const response = await fetch('/api/member-history/dashboard-stats');
        if (!response.ok) {
          throw new Error('Dashboard stats endpoint failed');
        }
        const data = await response.json();
        console.log('📊 Dashboard stats loaded:', data);
        return data;
      } catch (error) {
        console.log('📊 Dashboard stats endpoint failed:', error);
        return {
          totalAccounts: 0,
          accountsWithBalance: 0,
          totalBalance: 0,
          usedAccounts: 0
        };
      }
    },
    refetchInterval: 300000, // PRODUCTION: Refresh every 5 minutes for dashboard stats
    staleTime: 30000,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Calculate valid member count from existing data
  const validMemberCount = React.useMemo(() => {
    if (!memberHistory || memberHistory.length === 0) return 0;
    
    const validMembers = new Set<string>();
    memberHistory.forEach((member: any) => {
      // Check both camelCase and snake_case field names
      const memberName = member.memberName || member.member_name;
      const phoneNumber = member.phoneNumber || member.phone_number;
      
      // More permissive filter - include accounts with any member name
      if (memberName && 
          memberName.trim() !== '' && 
          memberName !== 'null' && 
          memberName !== 'undefined' &&
          memberName !== '.' &&
          memberName !== '..' &&
          memberName.length > 1) {
        validMembers.add(phoneNumber);
      }
    });
    
    console.log('🔍 Valid member count calculation:', {
      totalRecords: memberHistory.length,
      validMembersFound: validMembers.size,
      sampleMembers: Array.from(validMembers).slice(0, 5)
    });
    
    return validMembers.size;
  }, [memberHistory]);

  // OPTIMIZED: Account segment counters - Always use ultra-fast sidebar data
  const accountSegmentCounts = React.useMemo(() => {
    // Always use ultra-fast sidebar counters - no fallback to avoid loading all data
    if (sidebarCounters && !isLoadingSidebar) {
      console.log('⚡ Using ultra-fast sidebar counters:', sidebarCounters);
      return {
        accounts100Plus: sidebarCounters.accounts100Plus || 0,
        accounts50Plus: sidebarCounters.accounts50Plus || 0,
        accounts20Plus: sidebarCounters.accounts20Plus || 0,
        accounts10Plus: sidebarCounters.accounts10Plus || 0,
        accounts5Plus: sidebarCounters.accounts5Plus || 0,
        newAccounts: sidebarCounters.newAccounts || 0
      };
    }
    
    // OPTIMIZED: Return zeros if sidebar data is not available instead of calculating from all data
    console.log('⏳ Sidebar counters not ready yet, showing zeros temporarily');
    return {
      accounts100Plus: 0,
      accounts50Plus: 0,
      accounts20Plus: 0,
      accounts10Plus: 0,
      accounts5Plus: 0,
      newAccounts: 0
    };
  }, [memberHistory, realtimeUpdates, sidebarCounters, isLoadingSidebar]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('🔗 WebSocket connected for real-time updates');
      setWsConnection(ws);
      
      // Check if there's an active bulk update when connecting
      fetch('/api/member-history/bulk-update-status')
        .then(response => response.json())
        .then(data => {
          if (data.active) {
            console.log('🔄 DETECTED ACTIVE BULK UPDATE ON RECONNECT:', data);
            setGlobalUpdateInProgress(true);
            setGlobalUpdateProgress({ 
              current: data.processed || 0, 
              total: data.total || 0 
            });
            setUpdatingCategory(data.category);
          }
        })
        .catch(error => {
          console.log('No active bulk update detected on connect');
        });
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'valid_account_found') {
          console.log('✅ Nueva cuenta válida detectada:', data);
          
          // Trigger re-calculation of account segments
          setRealtimeUpdates(prev => prev + 1);
          
          // CRITICAL: Invalidate sidebar counters for real-time menu updates
          queryClient.invalidateQueries({ 
            queryKey: ['/api/member-history/sidebar-counters'] 
          });
          
          // Invalidate member history to refresh data
          queryClient.invalidateQueries({ 
            queryKey: ['/api/member-history'] 
          });
          
          // Show toast notification
      console.log("Toast notification removed");
        }
        
        // Handle bulk update progress
        if (data.type === 'bulk_update_progress') {
          console.log('📊 BULK UPDATE PROGRESS:', data);
          setGlobalUpdateProgress({
            current: data.current,
            total: data.total
          });
          setCurrentlyUpdatingAccount(data.phoneNumber);
          
          // Add visual update indicator
          if (data.phoneNumber) {
            setUpdatingAccounts(prev => new Set(Array.from(prev).concat([data.phoneNumber])));
            // Remove after animation
            setTimeout(() => {
              setUpdatingAccounts(prev => {
                const next = new Set(prev);
                next.delete(data.phoneNumber);
                return next;
              });
            }, 1000);
          }
        }
        
        // Handle bulk update complete
        if (data.type === 'bulk_update_complete') {
          console.log('✅ BULK UPDATE COMPLETE:', data);
          setGlobalUpdateInProgress(false);
          setGlobalUpdateProgress({ current: 0, total: 0 });
          setUpdatingCategory(null);
          setCurrentlyUpdatingAccount(null);
          
          // CRITICAL: Refresh sidebar counters immediately after bulk updates
          queryClient.invalidateQueries({ queryKey: ['/api/member-history/sidebar-counters'] });
          queryClient.invalidateQueries({ queryKey: ['/api/member-history'] });
          queryClient.invalidateQueries({ queryKey: ['/api/category-data'] });
        }
        
        // Handle bulk update cancelled
        if (data.type === 'bulk_update_cancelled') {
          console.log('🛑 BULK UPDATE CANCELLED:', data);
          setGlobalUpdateInProgress(false);
          setGlobalUpdateProgress({ current: 0, total: 0 });
          setUpdatingCategory(null);
          setCurrentlyUpdatingAccount(null);
          setUpdatingAccounts(new Set());
          
          console.log(`Process stopped at ${data.processedCount}/${data.totalCount} accounts`);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    ws.onclose = () => {
      console.log('❌ WebSocket connection closed');
      setWsConnection(null);
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Load all marked accounts on initial component mount
  useEffect(() => {
    loadAllMarkedAccounts();
  }, []);

  // Sync marked accounts with database data when memberHistory changes
  useEffect(() => {
    if (memberHistory && memberHistory.length > 0 && markedAccountsLoaded) {
      // Only update with additional marked accounts found in memberHistory
      const additionalMarked = new Set<string>();
      memberHistory.forEach((member: any) => {
        if (member.markedAsUsed) {
          additionalMarked.add(member.phoneNumber);
        }
      });
      
      // Merge with existing marked accounts
      setMarkedAccounts(prev => {
        const merged = new Set([...Array.from(prev), ...Array.from(additionalMarked)]);
        if (merged.size !== prev.size) {
          console.log(`🔄 MERGED MARKED ACCOUNTS: ${prev.size} → ${merged.size} accounts`);
        }
        return merged;
      });
    }
  }, [memberHistory, markedAccountsLoaded]);

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const phoneNumber = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (phoneNumber.length <= 3) {
      return phoneNumber;
    } else if (phoneNumber.length <= 6) {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    } else {
      return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setSearchTerm(formatted);
  };



  const handleUploadNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    
      console.log("Toast notification removed");
  };

  // Handle Excel export
  const handleExportToExcel = async (type: 'all' | 'balanced' = 'all') => {
    try {
      const endpoint = type === 'balanced' ? '/api/export/phone-database-balanced' : '/api/export/phone-database';
      const description = type === 'balanced' ? 'cuentas con balance' : 'base de datos completa';
      
      console.log(`📊 INICIANDO EXPORTACIÓN A EXCEL: Descargando ${description}...`);
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        throw new Error(`Error al exportar: ${response.status}`);
      }

      // Get the file as a blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      // Get filename from response header or create default
      const contentDisposition = response.headers.get('content-disposition');
      let filename;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        filename = filenameMatch ? filenameMatch[1] : `export_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else {
        const currentDate = new Date().toISOString().split('T')[0];
        filename = type === 'balanced' ? `cuentas_con_balance_${currentDate}.xlsx` : `base_datos_telefonos_${currentDate}.xlsx`;
      }
      
      a.download = filename;
      
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log(`✅ EXPORTACIÓN COMPLETADA: Archivo ${filename} descargado exitosamente`);
      
    } catch (error) {
      console.error("❌ ERROR EN EXPORTACIÓN:", error);
      console.log("Toast notification removed");
    }
  };

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      href: '/admin',
      description: 'Vista general del sistema'
    },
    {
      id: 'accounts',
      label: 'More $100',
      icon: Users,
      href: '/admin/accounts',
      description: 'Cuentas con $100+ en rewards'
    },
    {
      id: 'accounts-50-plus',
      label: 'More $50',
      icon: Users,
      href: '/admin/accounts-50-plus',
      description: 'Cuentas con $50-$99.99 en rewards'
    },
    {
      id: 'accounts-20-plus',
      label: 'More $20',
      icon: Users,
      href: '/admin/accounts-20-plus',
      description: 'Cuentas con $20-$49.99 en rewards'
    },
    {
      id: 'accounts-10-plus',
      label: 'More $10',
      icon: Users,
      href: '/admin/accounts-10-plus',
      description: 'Cuentas con $10-$19.99 en rewards'
    },
    {
      id: 'accounts-5-plus',
      label: 'More $5',
      icon: Users,
      href: '/admin/accounts-5-plus',
      description: 'Cuentas con $5-$9.99 en rewards'
    },
    {
      id: 'new-accounts',
      label: 'New',
      icon: Users,
      href: '/admin/new-accounts',
      description: 'Cuentas con $0-$4.99 en rewards'
    },
    {
      id: 'search',
      label: 'Lookup',
      icon: Search,
      href: '/admin/search',
      description: 'Buscar miembros por teléfono'
    },
    {
      id: 'all-accounts',
      label: 'Ver Cuentas',
      icon: Users,
      href: '/admin/all-accounts',
      description: 'Ver todas las cuentas ordenadas por rewards'
    },
    {
      id: 'today-activity',
      label: 'Actividad Hoy',
      icon: Calendar,
      href: '/admin/today-activity',
      description: 'Ver toda la actividad del día actual'
    },
    {
      id: 'balance-rewards',
      label: 'Balance Rewards',
      icon: Activity,
      href: '/admin/balance-rewards',
      description: 'Pruebas de Balance Rewards API'
    },
    {
      id: 'api-keys',
      label: 'API Keys',
      icon: Tag,
      href: '/admin/api-keys',
      description: 'Estadísticas del pool de API keys'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      href: '/admin/settings',
      description: 'Configuración del sistema y auto-reset'
    }
  ];

  const renderSettingsContent = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Configuración del Sistema</h2>
      </div>
      
      <div className="grid gap-6">
        {/* API Keys Management */}
        <APIKeyPoolStats />
        
        <AutoResetStatus />
        
        {/* Export Database Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-green-600" />
              Exportar Base de Datos a Excel
            </CardTitle>
            <CardDescription>
              Descarga toda la información de los clientes en archivos Excel organizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h4 className="font-medium text-green-700">Solo Cuentas con Balance</h4>
                <p className="text-sm text-gray-600">
                  Exporta ~411,246 cuentas que tienen balance en rewards. Descarga más rápida.
                </p>
                <Button
                  onClick={() => handleExportToExcel('balanced')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Excel Balance
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-blue-700">Base de Datos Completa</h4>
                <p className="text-sm text-gray-600">
                  Exporta TODOS los 412,000 registros. Incluye cuentas sin balance. Descarga más lenta.
                </p>
                <Button
                  onClick={() => handleExportToExcel('all')}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Descargar Excel Completo
                </Button>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 text-yellow-600 mt-0.5">ℹ️</div>
                <div>
                  <h5 className="font-medium text-yellow-800">Información del archivo Excel:</h5>
                  <ul className="text-sm text-yellow-700 mt-1 space-y-1">
                    <li>• Números de teléfono completos</li>
                    <li>• Nombres de todos los miembros</li>
                    <li>• Balances en dólares</li>
                    <li>• Emails y fechas de actividad</li>
                    <li>• Headers en español para fácil lectura</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderSearchContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Miembro
          </CardTitle>
          <CardDescription>
            Busca un miembro por número de teléfono
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleMemberSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone-search">Número de teléfono</Label>
              <Input
                id="phone-search"
                type="tel"
                placeholder="(555) 123-4567"
                value={searchTerm}
                onChange={handlePhoneChange}
                disabled={isLoading}
                maxLength={14}
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                'Buscar Miembro'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  const renderTodayActivityContent = () => {
    // Query to get today's activity
    const { data: todayActivityData, isLoading: loadingTodayActivity, error: todayActivityError } = useQuery({
      queryKey: ['/api/member-history/today-activity'],
      queryFn: async () => {
        const response = await fetch('/api/member-history/today-activity');
        if (!response.ok) throw new Error('Failed to fetch today activity');
        return response.json();
      },
      staleTime: 120000, // Cache for 2 minutes
      refetchInterval: 300000, // PRODUCTION: Auto-refresh every 5 minutes instead of 1 minute
    });

    // Debug logging
    console.log('📅 TODAY ACTIVITY DEBUG:', { 
      todayActivityData, 
      isLoading: loadingTodayActivity, 
      error: todayActivityError,
      dataType: typeof todayActivityData,
      dataLength: todayActivityData?.length,
      dataIsArray: Array.isArray(todayActivityData)
    });

    const todayDate = new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric', 
      month: 'long',
      day: 'numeric'
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Actividad de Hoy</h2>
            <p className="text-gray-600">{todayDate}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Resumen del Día
            </CardTitle>
            <CardDescription>
              Todas las transacciones y actividades detectadas hoy
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTodayActivity ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
                <p className="text-gray-500 mt-2">Cargando actividad de hoy...</p>
              </div>
            ) : todayActivityError ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">
                  <Activity className="h-12 w-12 mx-auto" />
                </div>
                <p className="text-red-600">Error al cargar la actividad de hoy</p>
                <p className="text-sm text-gray-500 mt-1">{todayActivityError.message}</p>
              </div>
            ) : todayActivityData && todayActivityData.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{todayActivityData.length}</div>
                    <div className="text-sm text-green-700">Cuentas con Actividad</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      ${todayActivityData.reduce((sum: number, account: any) => sum + (parseFloat(account.currentBalanceDollars) || 0), 0).toFixed(2)}
                    </div>
                    <div className="text-sm text-blue-700">Balance Total</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {todayActivityData.filter((account: any) => markedAccounts.has(account.phoneNumber)).length}
                    </div>
                    <div className="text-sm text-purple-700">Marcadas como Usadas</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {todayActivityData.map((member: any, index: number) => (
                    <div key={`${member.phoneNumber}-${index}`} className="mobile-list-item bg-white border border-gray-200 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-green-600">
                            {member.memberName?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="font-medium text-gray-900 truncate">{member.memberName}</div>
                            {markedAccounts.has(member.phoneNumber) && (
                              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{member.phoneNumber}</div>
                          <div className="text-xs text-gray-400">
                            Actividad: {member.lastActivityDate ? new Date(member.lastActivityDate).toLocaleString('es-ES') : 'N/A'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
                          ${formatBalance(member.currentBalanceDollars)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {member.lastAccessedAt ? new Date(member.lastAccessedAt).toLocaleDateString('es-ES') : 'Hoy'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Calendar className="h-16 w-16 mx-auto" />
                </div>
                <p className="text-gray-500 text-lg">No hay actividad registrada hoy</p>
                <p className="text-sm text-gray-400 mt-2">Las cuentas con actividad del día aparecerán aquí</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderUploadContent = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Números a la Cola
          </CardTitle>
          <CardDescription>
            Sube números de teléfono para verificar más tarde. Los duplicados se omiten automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUploadNumbers} className="space-y-4">
            <div className="space-y-2">
              <textarea
                placeholder="Pega aquí tu lista de números&#10;Un número por línea o separados por comas"
                className="w-full h-32 p-3 border rounded-md text-sm resize-none"
                disabled={false}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                type="submit" 
                className="bg-blue-600 hover:bg-blue-700 min-w-[140px]" 
              >
                {"Subir a Cola"}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                disabled={false}
              >
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  const handleViewAccount = async (phoneNumber: string) => {
    setLoadingAccounts(prev => new Set(prev).add(phoneNumber));
    
    try {
      // Invalidate all offer-related cache before making fresh API call
      await queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey as string[];
        return key.some(k => typeof k === 'string' && (
          k.includes('/api/offers') || 
          k.includes('/api/clipped') || 
          k.includes('/api/redeemed') ||
          k.includes('offer-stats')
        ));
      }});
      
      // Use live Walgreens API as primary source
      console.log('🔴 CONSULTING LIVE WALGREENS API for:', phoneNumber);
      let response = await fetch('/api/lookup-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      // If live API fails, fallback to local data
      if (!response.ok) {
        console.log('🔄 Live API failed, trying cached data...');
        response = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber })
        });
      }
      
      if (!response.ok) {
        throw new Error('Member not found in live or local data');
      }
      
      const data = await response.json();
      console.log('🔴 LIVE API DATA RECEIVED:', data);
      console.log('🔴 RAW MEMBER DATA STRUCTURE:', data.rawMemberData);
      console.log('🔴 RAW LOOKUP DATA STRUCTURE:', data.rawLookupData);
      console.log('🔴 CARD NUMBER PATH TEST:', data.rawMemberData?.CardNumber);
      console.log('🔴 ZIP CODE PATH TEST:', data.rawLookupData?.matchProfiles?.[0]?.zipCode);
      console.log('🔴 LAST ACTIVITY PATH TEST:', data.rawMemberData?.Reward?.LastActivityDate);
      console.log('🔴 POINTS PATH TEST:', data.rawMemberData?.Reward?.CurrentBalance);
      
      // Store in sessionStorage for compatibility
      sessionStorage.setItem('memberData', JSON.stringify(data));
      sessionStorage.setItem('memberPhone', phoneNumber);
      
      // FORCE FRESH DATA: Always use fresh API data, never cached
      const dashboardData = {
        memberData: data.rawMemberData,
        lookupData: data.rawLookupData,
        encLoyaltyId: data.encLoyaltyId,
        profile: data.profile,
        isFreshData: true // Flag to force fresh data usage
      };
      
      console.log('🔥 FORCING FRESH DATA TO DASHBOARD:', dashboardData);
      
      // Set selected member for display in main area
      setSelectedMember(dashboardData);
      setClientMenuActive('overview');
      
      // Navigate to member dashboard instead of staying in admin
      navigate(`/member/${phoneNumber}/overview`);
      
      console.log("Toast notification removed");
    } catch (error) {
      console.error('❌ LIVE API ERROR:', error);
      
      // Check if it's a "not found" error and handle account deletion
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('Cuenta no encontrada') || errorMessage.includes('eliminada de la base de datos')) {
        // Refresh the UI to remove the deleted account
        queryClient.invalidateQueries({ queryKey: ['/api/member-history'] });
        queryClient.invalidateQueries({ queryKey: ['/api/member-history/sidebar-counters'] });
        
        console.log("Toast notification removed");
      } else {
        console.log("Toast notification removed");
      }
    } finally {
      setLoadingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(phoneNumber);
        return newSet;
      });
    }
  };

  const handleMarkAsUsed = async (phoneNumber: string) => {
    setMarkingMember(phoneNumber);
    try {
      const isCurrentlyMarked = markedAccounts.has(phoneNumber);
      
      if (isCurrentlyMarked) {
        console.log(`🔄 UNMARKING: ${phoneNumber} - removing marked status`);
        
        const response = await fetch(`/api/member-history/unmark-used`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phoneNumber }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ API Error unmarking:', errorData);
          throw new Error(`Failed to unmark account: ${errorData.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(`✅ UNMARKED: ${phoneNumber}`, result);
        
        // Update local state - remove from marked accounts
        setMarkedAccounts(prev => {
          const newSet = new Set(prev);
          newSet.delete(phoneNumber);
          return newSet;
        });
        
      } else {
        console.log(`🟢 MARKING AS USED: ${phoneNumber} with API refresh and move to end`);
        
        const response = await fetch(`/api/member-history/mark-used`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            phoneNumber,
            refreshedFromAPI: true,  // Refresh data from Walgreens API first
            moveToEnd: true        // Move account to end of list
          }),
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          console.error('❌ API Error:', errorData);
          throw new Error(`Failed to mark account as used: ${errorData.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log(`✅ MARKED AS USED: ${phoneNumber}`, result);
        
        // Update local state - add to marked accounts
        setMarkedAccounts(prev => new Set(prev).add(phoneNumber));
      }
      
      // Refresh all queries to show updated data and reordering
      await queryClient.invalidateQueries({ queryKey: ['/api/member-history'] });
      await queryClient.invalidateQueries({ queryKey: [getCategoryEndpoint(currentTab)] });
      
      // Small delay to allow UI to update
      setTimeout(() => {
        console.log('✅ UI refreshed after marking account');
      }, 500);
      
    } catch (error) {
      console.error('❌ Error toggling account marked status:', error);
      console.error('Error details:', error);
      
      // Show error to user without toast
      console.log('❌ FRONTEND ERROR: Failed to mark account as used. Check console for details.');
    } finally {
      setMarkingMember(null);
    }
  };

  // Function to automatically mark accounts with today's activity as "used"
  const handleAutoMarkTodayActivity = async () => {
    // Prevent multiple clicks
    if (autoMarkingToday) {
      console.log('🚫 AUTO-MARK already in progress, ignoring click');
      return;
    }
    
    setAutoMarkingToday(true);
    try {
      console.log(`🗓️ AUTO-MARKING: Starting auto-mark for accounts with today's activity...`);
      
      const response = await fetch('/api/member-history/auto-mark-today-activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to auto-mark accounts with today activity');
      }

      const result = await response.json();
      console.log(`✅ AUTO-MARK COMPLETED: ${result.markedCount} accounts marked with today's activity`);
      
      if (result.markedCount > 0) {
        // Update local state with newly marked accounts
        const newMarkedAccounts = result.markedPhoneNumbers || [];
        setMarkedAccounts(prev => {
          const updated = new Set(prev);
          newMarkedAccounts.forEach((phone: string) => updated.add(phone));
          return updated;
        });
        
        // Refresh all queries to show updated data
        queryClient.invalidateQueries({ queryKey: ['/api/member-history'] });
        queryClient.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey as string[];
          return key.some(k => typeof k === 'string' && k.includes('/api/member-history/accounts-'));
        }});
        
        console.log(`🔄 CACHE REFRESHED: Updated marked status for ${result.markedCount} accounts`);
      }
      
      // Wait a bit so user can see the action completed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error('Error auto-marking accounts with today activity:', error);
    } finally {
      setAutoMarkingToday(false);
    }
  };

  // Optimized marked accounts loading (reduced logging)
  const loadAllMarkedAccounts = async () => {
    if (markedAccountsLoaded) return;
    
    try {
      const response = await fetch('/api/member-history/all-marked');
      if (response.ok) {
        const data = await response.json();
        const markedNumbers = data.markedPhoneNumbers || [];
        setMarkedAccounts(new Set(markedNumbers));
        setMarkedAccountsLoaded(true);
      }
    } catch (error) {
      // Silent fail to avoid performance impact
    }
  };

  // Helper function to sync marked status from database using optimized endpoint
  const syncMarkedStatusFromDatabase = async (phoneNumbers: string[]) => {
    try {
      console.log(`🔄 SYNCING MARKED STATUS: Checking ${phoneNumbers.length} accounts for marked status...`);
      
      const markedStatusPromises = phoneNumbers.map(async (phoneNumber) => {
        try {
          const response = await fetch(`/api/member-history/marked-status/${phoneNumber}`);
          if (response.ok) {
            const markedData = await response.json();
            return {
              phoneNumber,
              isMarked: markedData?.markedAsUsed || false
            };
          }
        } catch (error) {
          console.error(`Error checking marked status for ${phoneNumber}:`, error);
        }
        return { phoneNumber, isMarked: false };
      });
      
      const markedStatuses = await Promise.all(markedStatusPromises);
      
      setMarkedAccounts(prev => {
        const newMarkedAccounts = new Set(prev);
        markedStatuses.forEach(({ phoneNumber, isMarked }) => {
          if (isMarked) {
            newMarkedAccounts.add(phoneNumber);
          } else {
            newMarkedAccounts.delete(phoneNumber);
          }
        });
        console.log(`✅ MARKED STATUS SYNCED: ${newMarkedAccounts.size} accounts marked from optimized endpoint`);
        return newMarkedAccounts;
      });
    } catch (error) {
      console.error('Error syncing marked status:', error);
    }
  };

  // Global category update function - OPTIMIZED to use background processing
  const handleGlobalCategoryUpdate = async (tab: string, visibleMembers: any[]) => {
    console.log(`🌐 GLOBAL UPDATE: Starting background update for ${tab} category`);
    
    // Get the category endpoint
    const endpoint = getCategoryEndpoint(tab);
    if (!endpoint) {
      console.error('❌ No endpoint found for tab:', tab);
      return;
    }

    // Set the updating category and initialize progress
    setUpdatingCategory(tab);
    setGlobalUpdateInProgress(true);
    setGlobalUpdateProgress({ current: 0, total: visibleMembers.length || 0 });

    try {
      // Use the background update endpoint to process without blocking UI
      console.log(`🚀 BACKGROUND UPDATE: Processing ${tab} category in background...`);
      
      const response = await fetch('/api/member-history/bulk-update-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category: tab,
          endpoint: endpoint 
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start background update: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`✅ BACKGROUND UPDATE STARTED: ${result.message}`);
      console.log(`📊 Processing ${result.totalAccounts || 'all'} accounts in background`);
      
      // Update total count from server response
      setGlobalUpdateProgress(prev => ({ ...prev, total: result.totalAccounts || visibleMembers.length }));
      
      // Show success message in console
      console.log(`🎉 La actualización se está procesando en segundo plano. Puedes continuar navegando mientras se actualiza.`);
      
      // Refresh data periodically to show progress
      const refreshInterval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: [endpoint] });
        queryClient.invalidateQueries({ queryKey: ['/api/member-history/sidebar-counters'] });
      }, 5000); // Refresh every 5 seconds
      
      // Stop refreshing after 2 minutes (background process should be done by then)
      setTimeout(() => {
        clearInterval(refreshInterval);
      }, 120000);
      
    } catch (error) {
      console.error('❌ BACKGROUND UPDATE ERROR:', error);
      console.log(`❌ Error al iniciar la actualización en segundo plano`);
      // Reset states on error
      setUpdatingCategory(null);
      setGlobalUpdateInProgress(false);
      setGlobalUpdateProgress({ current: 0, total: 0 });
    }
  };

  const handleUpdateAccount = async (phoneNumber: string) => {
    setUpdatingAccounts(prev => new Set(prev).add(phoneNumber));
    try {
      const response = await fetch('/api/lookup-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update account');
      }
      
      const data = await response.json();
      console.log('✅ Account updated successfully:', data);
      
      // Extract the new balance and last activity from the response
      const newBalance = data.rawMemberData?.Reward?.CurrentBalanceDollars || 
                        (data.rawMemberData?.Reward?.CurrentBalance ? data.rawMemberData.Reward.CurrentBalance / 1000 : null) ||
                        data.profile?.balance || 
                        '0.00';
      
      const lastActivity = data.rawMemberData?.Reward?.LastActivityDate || 
                          data.rawMemberData?.lastActivityDate || 
                          null;
      
      // Update the local state with the new balance immediately
      setUpdatedBalances(prev => ({
        ...prev,
        [phoneNumber]: {
          balance: newBalance.toString(),
          lastActivity: lastActivity
        }
      }));
      
      // ✅ AUTO-MARK: Check if the account has activity from today and mark it automatically
      let isToday = false;
      if (lastActivity) {
        const activityDate = new Date(lastActivity);
        const today = new Date();
        
        // Check if the activity date is today (same day)
        isToday = activityDate.getFullYear() === today.getFullYear() &&
                  activityDate.getMonth() === today.getMonth() &&
                  activityDate.getDate() === today.getDate();
        
        if (isToday && !markedAccounts.has(phoneNumber)) {
          console.log(`🎯 AUTO-MARK: Account ${phoneNumber} has activity from today (${lastActivity}), marking as used...`);
          
          try {
            const markResponse = await fetch('/api/member-history/mark-used', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                phoneNumber,
                refreshedFromAPI: false, // We already have fresh data
                moveToEnd: true
              })
            });

            if (markResponse.ok) {
              setMarkedAccounts(prev => new Set(prev).add(phoneNumber));
              console.log(`✅ AUTO-MARKED: Account ${phoneNumber} automatically marked as used (today's activity)`);
            } else {
              console.error(`❌ Failed to auto-mark account ${phoneNumber}:`, markResponse.statusText);
            }
          } catch (markError) {
            console.error(`❌ Error auto-marking account ${phoneNumber}:`, markError);
          }
        } else if (isToday) {
          console.log(`⏭️ ALREADY MARKED: Account ${phoneNumber} has today's activity but is already marked`);
        }
      }
      
      // OPTIMIZED: Reduced database calls and cache invalidation
      // Only sync if auto-marked to avoid excessive queries
      if (isToday && !markedAccounts.has(phoneNumber)) {
        await syncMarkedStatusFromDatabase([phoneNumber]);
      }
      
      console.log("Account balance updated successfully and marked status synced");
    } catch (error) {
      console.error('Error updating account:', error);
      console.log("Failed to update account balance");
    } finally {
      setUpdatingAccounts(prev => {
        const newSet = new Set(prev);
        newSet.delete(phoneNumber);
        return newSet;
      });
    }
  };

  const handleUpdateAllAccounts = async (members: any[]) => {
    const phoneNumbers = members.map(member => member.phoneNumber || member.phone_number);
    
    console.log(`🔄 UPDATING ALL ACCOUNTS: Starting sequential update for ${phoneNumbers.length} accounts`);
    
    let updated = 0;
    let failed = 0;
    
    for (const phoneNumber of phoneNumbers) {
      try {
        console.log(`🔄 Updating account ${updated + 1}/${phoneNumbers.length}: ${phoneNumber}`);
        await handleUpdateAccount(phoneNumber);
        updated++;
        
        // Small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ Failed to update account ${phoneNumber}:`, error);
        failed++;
      }
    }
    
    console.log(`✅ BATCH UPDATE COMPLETED: ${updated} updated, ${failed} failed`);
  };



  // Reset page index when changing segments
  useEffect(() => {
    setHistoryPageIndex(1);
  }, [currentTab]);

  // Reset filters when changing sections (limpiar al pasar de una página a la otra)
  useEffect(() => {
    console.log('🧹 FILTER RESET: Clearing search and date filters for tab:', currentTab);
    setLocalSearchTerm("");
    setDebouncedSearchTerm("");
    setLocalDateFilter("all");
  }, [currentTab]);

  // Generic function to render account segments
  const renderAccountSegmentContent = (segmentKey: string, title: string, description: string, borderColor: string, minBalance: number, maxBalance?: number) => {
    console.log(`🔍 Filtering ${segmentKey}: minBalance=${minBalance}, maxBalance=${maxBalance}, totalMembers=${memberHistory?.length || 0}, isLoading=${isLoadingHistory}, currentPage=${historyPageIndex}`);
    
    // CRITICAL FIX: Wait for data to load before filtering
    if (isLoadingHistory || !memberHistory || memberHistory.length === 0) {
      console.log(`⏳ ${segmentKey}: Waiting for member history data to load...`);
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                {isLoadingHistory ? 'Cargando cuentas...' : 'No hay cuentas disponibles'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                {isLoadingHistory ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-gray-500 mt-2">Cargando cuentas disponibles...</p>
                    <p className="text-xs text-gray-400 mt-1">Esto puede tomar unos segundos en producción</p>
                  </>
                ) : (
                  <>
                    <div className="text-gray-400 mb-4">
                      <Users className="h-12 w-12 mx-auto" />
                    </div>
                    <p className="text-gray-500">No se pudieron cargar las cuentas</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta recargar la página</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }
    
    // OPTIMIZED: Backend already filtered by balance, only validate member name here
    const filteredMembers = memberHistory.filter((member: any) => {
      const memberName = member.memberName || member.member_name;
      const balance = parseFloat(member.currentBalanceDollars || member.current_balance_dollars || 0);
      
      const isValidMember = memberName && 
        memberName.trim() !== '' && 
        memberName !== 'null' && 
        memberName !== 'undefined';
      
      // REMOVED: Backend already filtered by balance range, no need to filter again
      // const isInBalanceRange = balance >= minBalance && (maxBalance === undefined || balance < maxBalance);
      
      if (segmentKey === 'accounts' && isValidMember) {
        console.log(`✅ Found ${segmentKey} member: ${memberName} - $${balance}`);
      }
      
      return isValidMember; // Backend already handles balance filtering
    });
    
    console.log(`📊 ${segmentKey} filtered results: ${filteredMembers.length} members`);
    if (filteredMembers.length > 0) {
      console.log(`📋 Sample ${segmentKey} members:`, filteredMembers.slice(0, 3).map(m => ({
        name: m.memberName || m.member_name,
        phone: m.phoneNumber || m.phone_number,
        balance: m.currentBalanceDollars || m.current_balance_dollars
      })));
    }

    // Sort filtered members: unmarked accounts first, marked accounts last
    const sortedMembers = filteredMembers.sort((a: any, b: any) => {
      const phoneA = a.phoneNumber || a.phone_number;
      const phoneB = b.phoneNumber || b.phone_number;
      const isMarkedA = markedAccounts.has(phoneA);
      const isMarkedB = markedAccounts.has(phoneB);
      
      // If both marked or both unmarked, maintain original order
      if (isMarkedA === isMarkedB) return 0;
      
      // Put unmarked accounts first (return -1 if A is unmarked and B is marked)
      return isMarkedA ? 1 : -1;
    });
    
    // Apply local filtering only when debounced term changes
    const localFilteredMembers = (!debouncedSearchTerm && localDateFilter === 'all') 
      ? sortedMembers 
      : filterLocalAccounts(sortedMembers);
    
    const hasLocalFilters = localSearchTerm.trim() || localDateFilter !== 'all';
    
    // When filters are active, show all filtered results without pagination
    // When no filters are active, use normal pagination
    const membersToShow = hasLocalFilters ? localFilteredMembers : sortedMembers;
    const totalPages = hasLocalFilters ? 1 : Math.ceil(sortedMembers.length / 25);
    const startIndex = hasLocalFilters ? 0 : (historyPageIndex - 1) * 25;
    const endIndex = hasLocalFilters ? membersToShow.length : startIndex + 25;
    const currentMembers = hasLocalFilters ? membersToShow : sortedMembers.slice(startIndex, endIndex);
    
    // CRITICAL DEBUG: Log pagination details
    console.log(`📄 ${segmentKey} PAGINATION DEBUG:`, {
      filteredCount: filteredMembers.length,
      totalPages,
      currentPage: historyPageIndex,
      startIndex,
      endIndex,
      currentMembersCount: currentMembers.length,
      sampleCurrentMembers: currentMembers.slice(0, 2).map(m => ({
        name: m.memberName || m.member_name,
        phone: m.phoneNumber || m.phone_number,
        balance: m.currentBalanceDollars || m.current_balance_dollars
      }))
    });

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {title}
                </CardTitle>
                <CardDescription>
                  {hasLocalFilters ? `${currentMembers.length} de ${filteredMembers.length}` : filteredMembers.length} {description}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {!hasLocalFilters && (
                  <>
                    <span className="text-sm text-gray-600">
                      Página {historyPageIndex} de {totalPages}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPageIndex(prev => Math.max(1, prev - 1))}
                        disabled={historyPageIndex === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPageIndex(prev => Math.min(totalPages, prev + 1))}
                        disabled={historyPageIndex === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
                {hasLocalFilters && (
                  <span className="text-sm text-green-600 font-medium">
                    🔍 Filtrado activo
                  </span>
                )}
              </div>
            </div>
          </CardHeader>

          {/* Filtros Locales para Historial */}
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o teléfono..."
                    value={localSearchTerm}
                    onChange={(e) => setLocalSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </div>
              <div className="sm:w-48">
                <Select value={localDateFilter} onValueChange={setLocalDateFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filtrar por fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="this_week">Esta semana</SelectItem>
                    <SelectItem value="this_month">Este mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(localSearchTerm || localDateFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocalSearchTerm("");
                    setLocalDateFilter("all");
                  }}
                  className="h-9 px-3"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          <CardContent>
            {(() => {
              // currentMembers already contains the filtered results, no need to filter again
              const showingFiltered = hasLocalFilters;
              
              return (
                <>
                  {showingFiltered && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <Filter className="inline h-4 w-4 mr-1" />
                        Mostrando {currentMembers.length} de {filteredMembers.length} cuentas
                        {localSearchTerm && ` • Búsqueda: "${localSearchTerm}"`}
                        {localDateFilter !== 'all' && ` • Fecha: ${
                          localDateFilter === 'today' ? 'Hoy' :
                          localDateFilter === 'yesterday' ? 'Ayer' :
                          localDateFilter === 'this_week' ? 'Esta semana' :
                          localDateFilter === 'this_month' ? 'Este mes' :
                          localDateFilter
                        }`}
                      </p>
                    </div>
                  )}

                  {currentMembers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div>{showingFiltered ? 'No hay cuentas que coincidan con los filtros' : 'No hay cuentas verificadas'}</div>
                      <div className="text-xs mt-2">
                        {showingFiltered ? 'Prueba ajustando los filtros de búsqueda' : `Página ${historyPageIndex} de ${totalPages}`}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentMembers.map((member: any) => (
                  <div
                    key={`${member.phoneNumber || member.phone_number}-${member.id}`}
                    className={`rounded-lg p-4 border-l-4 ${borderColor} hover:shadow-md transition-shadow ${
                      markedAccounts.has(member.phoneNumber || member.phone_number)
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200'
                        : 'bg-gradient-to-r from-slate-50 to-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-green-600">
                          ${formatBalance(member.currentBalanceDollars || member.current_balance_dollars)}
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.memberName || member.member_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.phoneNumber || member.phone_number}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAccount(member.phoneNumber || member.phone_number)}
                          disabled={loadingMember === (member.phoneNumber || member.phone_number)}
                          className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                        >
                          {loadingMember === (member.phoneNumber || member.phone_number) ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Cargando...
                            </>
                          ) : (
                            'Ver Cuenta'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsUsed(member.phoneNumber || member.phone_number)}
                          disabled={markingMember === (member.phoneNumber || member.phone_number)}
                          className={`${
                            markedAccounts.has(member.phoneNumber || member.phone_number)
                              ? 'bg-green-100 border-green-300 text-green-800'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {markingMember === (member.phoneNumber || member.phone_number) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : markedAccounts.has(member.phoneNumber || member.phone_number) ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <User className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================================================
  // ENDPOINT-SPECIFIC DATA HOOKS - Each hook uses its own optimized endpoint
  // ============================================================================
  
  // Hook for $100+ accounts
  const { data: accounts100Plus, isLoading: loading100Plus } = useQuery({
    queryKey: [`/api/member-history/accounts-100-plus?page=${historyPageIndex}&size=25`],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'accounts' || currentTab === 'accounts-100-plus'
  });
  
  // Hook for $50-99.99 accounts
  const { data: accounts50Plus, isLoading: loading50Plus } = useQuery({
    queryKey: [`/api/member-history/accounts-50-plus?page=${historyPageIndex}&size=${(localSearchTerm || localDateFilter !== 'all') ? 999999 : 25}`],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'accounts-50-plus'
  });
  
  // Hook for $20-49.99 accounts
  const { data: accounts20Plus, isLoading: loading20Plus } = useQuery({
    queryKey: [`/api/member-history/accounts-20-plus?page=${historyPageIndex}&size=${(localSearchTerm || localDateFilter !== 'all') ? 999999 : 25}`],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'accounts-20-plus'
  });
  
  // Hook for $10-19.99 accounts
  const { data: accounts10Plus, isLoading: loading10Plus } = useQuery({
    queryKey: [`/api/member-history/accounts-10-plus?page=${historyPageIndex}&size=${(localSearchTerm || localDateFilter !== 'all') ? 999999 : 25}`],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'accounts-10-plus'
  });
  
  // Hook for $5-9.99 accounts
  const { data: accounts5Plus, isLoading: loading5Plus } = useQuery({
    queryKey: [`/api/member-history/accounts-5-plus?page=${historyPageIndex}&size=${(localSearchTerm || localDateFilter !== 'all') ? 999999 : 25}`],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'accounts-5-plus'
  });
  
  // Hook for $0-4.99 accounts
  const { data: newAccounts, isLoading: loadingNewAccounts } = useQuery({
    queryKey: [`/api/member-history/new-accounts?page=${historyPageIndex}&size=${(localSearchTerm || localDateFilter !== 'all') ? 999999 : 25}`],
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'new-accounts'
  });

  // Hook for ALL accounts ordered by balance (highest to lowest)
  const { data: allAccounts, isLoading: loadingAllAccounts } = useQuery({
    queryKey: [`/api/member-history/all-accounts?page=${historyPageIndex}&size=999999`], // Always load all data for filtering
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: currentTab === 'all-accounts' || currentTab === 'accounts'
  });

  // ============================================================================
  // ENDPOINT-SPECIFIC RENDER FUNCTIONS - Each uses its own data source
  // ============================================================================
  
  const renderAccountsContent = () => renderEndpointSpecificContent(
    accounts100Plus, loading100Plus, 'Cuentas', 'cuentas con $100+ en rewards', 'border-blue-500', 'accounts-100-plus'
  );
  
  const renderAccounts50PlusContent = () => renderEndpointSpecificContent(
    accounts50Plus, loading50Plus, 'More $50', 'cuentas con $50-$99.99 en rewards', 'border-green-500', 'accounts-50-plus'
  );
  
  const renderAccounts20PlusContent = () => renderEndpointSpecificContent(
    accounts20Plus, loading20Plus, 'More $20', 'cuentas con $20-$49.99 en rewards', 'border-yellow-500', 'accounts-20-plus'
  );
  
  const renderAccounts10PlusContent = () => renderEndpointSpecificContent(
    accounts10Plus, loading10Plus, 'More $10', 'cuentas con $10-$19.99 en rewards', 'border-orange-500', 'accounts-10-plus'
  );
  
  const renderAccounts5PlusContent = () => renderEndpointSpecificContent(
    accounts5Plus, loading5Plus, 'More $5', 'cuentas con $5-$9.99 en rewards', 'border-purple-500', 'accounts-5-plus'
  );
  
  const renderNewAccountsContent = () => renderEndpointSpecificContent(
    newAccounts, loadingNewAccounts, 'New', 'cuentas con $0-$4.99 en rewards', 'border-gray-500', 'new-accounts'
  );

  const renderAllAccountsContent = () => renderEndpointSpecificContent(
    allAccounts, loadingAllAccounts, 'Ver Cuentas', 'todas las cuentas ordenadas por rewards', 'border-indigo-500', 'all-accounts'
  );

  // ============================================================================
  // ENDPOINT-SPECIFIC RENDER FUNCTION - Uses direct endpoint data
  // ============================================================================
  const renderEndpointSpecificContent = (endpointData: any, isLoading: boolean, title: string, description: string, borderColor: string, category: string) => {
    console.log(`🎯 DIRECT ENDPOINT RENDER - ${title}:`, {
      endpointData: endpointData?.data?.length || 0,
      isLoading,
      currentPage: historyPageIndex
    });
    
    // Loading state
    if (isLoading || !endpointData) {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {title}
              </CardTitle>
              <CardDescription>
                {isLoading ? 'Cargando cuentas optimizadas...' : 'No hay datos disponibles'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                {isLoading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                    <p className="text-gray-500 mt-2">Usando endpoint optimizado...</p>
                    <p className="text-xs text-gray-400 mt-1">⚡ Consulta SQL directa activa</p>
                  </>
                ) : (
                  <>
                    <div className="text-gray-400 mb-4">
                      <Users className="h-12 w-12 mx-auto" />
                    </div>
                    <p className="text-gray-500">No se pudieron cargar las cuentas</p>
                    <p className="text-xs text-gray-400 mt-1">Intenta recargar la página</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Use categoryData when debounced filters are active (has all data), otherwise use endpointData
    const hasFilters = debouncedSearchTerm.trim() || localDateFilter !== 'all';
    const membersRaw = hasFilters ? (categoryData || []) : (endpointData.data || []);
    
    // Sort members: unmarked accounts first, marked accounts last
    const members = membersRaw.sort((a: any, b: any) => {
      const phoneA = a.phoneNumber || a.phone_number;
      const phoneB = b.phoneNumber || b.phone_number;
      const isMarkedA = markedAccounts.has(phoneA);
      const isMarkedB = markedAccounts.has(phoneB);
      
      // If both marked or both unmarked, maintain original order
      if (isMarkedA === isMarkedB) return 0;
      
      // Put unmarked accounts first (return -1 if A is unmarked and B is marked)
      return isMarkedA ? 1 : -1;
    });
    
    const totalCount = endpointData.pagination?.total || endpointData.total || members.length;
    const totalPages = endpointData.pagination?.pages || endpointData.totalPages || Math.ceil(totalCount / 25);
    
    console.log(`📊 DIRECT ENDPOINT SUCCESS - ${title}:`, {
      membersCount: members.length,
      totalCount,
      totalPages,
      currentPage: historyPageIndex,
      sampleMembers: members.slice(0, 3).map((m: any) => ({
        name: m.memberName || m.member_name,
        phone: m.phoneNumber || m.phone_number,
        balance: m.currentBalanceDollars || m.current_balance_dollars
      }))
    });

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-[16px]">
                  <Users className="h-5 w-5" />
                  {title} ⚡ Optimizado
                </CardTitle>
                <CardDescription>
                  {totalCount} {description} - Endpoint directo SQL
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGlobalCategoryUpdate(currentTab, members)}
                  disabled={globalUpdateInProgress && updatingCategory === currentTab}
                  className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                >
                  <RefreshCw className={`h-4 w-4 ${globalUpdateInProgress && updatingCategory === currentTab ? 'animate-spin' : ''}`} />
                  <span>
                    {globalUpdateInProgress && updatingCategory === currentTab 
                      ? `${globalUpdateProgress.current} de ${globalUpdateProgress.total}` 
                      : `Actualizar ${totalCount}`}
                  </span>
                </Button>
                

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Página</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={tempPageInput}
                    onChange={(e) => {
                      setTempPageInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePageNavigation(e.currentTarget.value, totalPages);
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      handlePageNavigation(e.currentTarget.value, totalPages);
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">de {totalPages}</span>
                </div>
                {totalPages > 1 && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log(`🔥 PAGINATION: Going to previous page from ${historyPageIndex}`);
                        setHistoryPageIndex(prev => Math.max(1, prev - 1));
                      }}
                      disabled={historyPageIndex === 1}
                      className="min-w-[40px] bg-white hover:bg-gray-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        console.log(`🔥 PAGINATION: Going to next page from ${historyPageIndex} (max: ${totalPages})`);
                        setHistoryPageIndex(prev => Math.min(totalPages, prev + 1));
                      }}
                      disabled={historyPageIndex >= totalPages}
                      className="min-w-[40px] bg-white hover:bg-gray-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Layout - Stacked */}
            <div className="block sm:hidden space-y-3">
              <div>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  {title}
                </CardTitle>
                <CardDescription className="text-xs">
                  {totalCount} {description}
                </CardDescription>
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGlobalCategoryUpdate(currentTab, members)}
                  disabled={globalUpdateInProgress && updatingCategory === currentTab}
                  className="h-7 px-2 flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 text-xs"
                >
                  <RefreshCw className={`h-3 w-3 ${globalUpdateInProgress && updatingCategory === currentTab ? 'animate-spin' : ''}`} />
                  <span>
                    {globalUpdateInProgress && updatingCategory === currentTab 
                      ? `${globalUpdateProgress.current}/${globalUpdateProgress.total}` 
                      : `Actualizar ${totalCount}`}
                  </span>
                </Button>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Pág</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={tempPageInput}
                      onChange={(e) => {
                        setTempPageInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePageNavigation(e.currentTarget.value, totalPages);
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => {
                        handlePageNavigation(e.currentTarget.value, totalPages);
                      }}
                      className="w-10 px-1 py-1 text-xs border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-xs text-gray-600">/{totalPages}</span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log(`🔥 PAGINATION: Going to previous page from ${historyPageIndex}`);
                          setHistoryPageIndex(prev => Math.max(1, prev - 1));
                        }}
                        disabled={historyPageIndex === 1}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log(`🔥 PAGINATION: Going to next page from ${historyPageIndex} (max: ${totalPages})`);
                          setHistoryPageIndex(prev => Math.min(totalPages, prev + 1));
                        }}
                        disabled={historyPageIndex >= totalPages}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Filtros Locales */}
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Buscar por nombre o teléfono..."
                    value={localSearchTerm}
                    onChange={(e) => setLocalSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>
              </div>
              <div className="w-24 sm:w-48">
                <Select value={localDateFilter} onValueChange={setLocalDateFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Fecha" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las fechas</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="this_week">Esta semana</SelectItem>
                    <SelectItem value="this_month">Este mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(localSearchTerm || localDateFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLocalSearchTerm("");
                    setLocalDateFilter("all");
                  }}
                  className="h-9 px-2 sm:px-3"
                >
                  <X className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Limpiar</span>
                </Button>
              )}
            </div>
          </div>

          <CardContent>
            {(() => {
              // Only filter when debounced term changes, not on every keystroke
              const filteredData = (!debouncedSearchTerm && localDateFilter === 'all') 
                ? members 
                : filterLocalAccounts(members);
              
              const showingFiltered = localSearchTerm || localDateFilter !== 'all';
              
              // Use filtered data for display, not original members
              const displayData = showingFiltered ? filteredData : members;
              
              // Debug logging for filtering
              if (localSearchTerm) {
                console.log(`🔍 FINAL DISPLAY DEBUG:`, {
                  searchTerm: localSearchTerm,
                  totalMembers: members.length,
                  filteredCount: filteredData.length,
                  displayCount: displayData.length,
                  showingFiltered,
                  firstDisplayItem: displayData[0] ? {
                    name: displayData[0].memberName || displayData[0].member_name,
                    phone: displayData[0].phoneNumber || displayData[0].phone_number
                  } : null
                });
              }
              
              return (
                <>
                  {showingFiltered && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <Filter className="inline h-4 w-4 mr-1" />
                        Mostrando {displayData.length} de {members.length} cuentas
                        {localSearchTerm && ` • Búsqueda: "${localSearchTerm}"`}
                        {localDateFilter !== 'all' && ` • Fecha: ${
                          localDateFilter === 'today' ? 'Hoy' :
                          localDateFilter === 'yesterday' ? 'Ayer' :
                          localDateFilter === 'this_week' ? 'Esta semana' :
                          localDateFilter === 'this_month' ? 'Este mes' :
                          localDateFilter
                        }`}
                      </p>
                    </div>
                  )}
                  
                  {displayData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <div>{showingFiltered ? 'No hay cuentas que coincidan con los filtros' : 'No hay cuentas en este rango de balance'}</div>
                      <div className="text-xs mt-2">
                        {showingFiltered ? 'Prueba ajustando los filtros de búsqueda' : `DEBUG: Endpoint directo - Página ${historyPageIndex}, Total: ${totalCount}`}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayData.map((member: any, index: number) => {
                        const phoneNumber = member.phoneNumber || member.phone_number;
                        const isCurrentlyUpdating = currentlyUpdatingAccount === phoneNumber;
                        
                        return (
                        <div key={`${phoneNumber}-${member.id || index}`} 
                             className={`p-4 border ${borderColor} rounded-lg transition-all duration-300 ${
                    markedAccounts.has(phoneNumber) 
                      ? 'bg-green-50 hover:bg-green-100 border-green-200' 
                      : 'bg-gray-50 hover:bg-gray-100'
                  } ${isCurrentlyUpdating ? 'account-updating' : ''}`}>
                    {/* Desktop Layout - Horizontal */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">
                            {(member.memberName || member.member_name || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{member.memberName || member.member_name}</p>
                          <p className="text-sm text-gray-600">{member.phoneNumber || member.phone_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-green-600">
                            ${formatBalance(
                              updatedBalances[member.phoneNumber || member.phone_number]?.balance || 
                              member.currentBalanceDollars || 
                              member.current_balance_dollars
                            )}
                          </p>
                          <p className="text-xs text-gray-500">
                            Última actividad: {(() => {
                              // Try updated balances first
                              if (updatedBalances[member.phoneNumber || member.phone_number]?.lastActivity) {
                                return new Date(updatedBalances[member.phoneNumber || member.phone_number].lastActivity).toLocaleDateString();
                              }
                              // Try member's last activity date
                              if (member.lastActivityDate || member.last_activity_date) {
                                return new Date(member.lastActivityDate || member.last_activity_date).toLocaleDateString();
                              }
                              // If no real activity date available, show "Sin actividad" instead of today's date
                              return "Sin actividad";
                            })()}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAccount(member.phoneNumber || member.phone_number)}
                          disabled={loadingAccounts.has(member.phoneNumber || member.phone_number)}
                          className="shrink-0 p-2"
                          title="Ver cuenta"
                        >
                          {loadingAccounts.has(member.phoneNumber || member.phone_number) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateAccount(member.phoneNumber || member.phone_number)}
                          disabled={updatingAccounts.has(member.phoneNumber || member.phone_number)}
                          className="shrink-0 p-2"
                          title="Actualizar balance"
                        >
                          {updatingAccounts.has(member.phoneNumber || member.phone_number) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsUsed(member.phoneNumber || member.phone_number)}
                          disabled={markingMember === (member.phoneNumber || member.phone_number)}
                          className={`shrink-0 p-2 ${markedAccounts.has(member.phoneNumber || member.phone_number) ? 'border-green-500 bg-green-50 hover:bg-green-100' : 'hover:bg-gray-100'}`}
                          title={markedAccounts.has(member.phoneNumber || member.phone_number) ? "Cuenta marcada como usada" : "Marcar como usada"}
                        >
                          {markingMember === (member.phoneNumber || member.phone_number) ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          ) : markedAccounts.has(member.phoneNumber || member.phone_number) ? (
                            <Check className="h-4 w-4 text-green-600 font-bold" />
                          ) : (
                            <div className="w-3 h-3 border-2 border-gray-400 rounded-full" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Layout - Low Profile */}
                    <div className="block sm:hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-blue-600">
                              {(member.memberName || member.member_name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs truncate">{member.memberName || member.member_name}</p>
                            <p className="text-xs text-gray-500 truncate">{member.phoneNumber || member.phone_number}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {(() => {
                                // Try updated balances first
                                if (updatedBalances[member.phoneNumber || member.phone_number]?.lastActivity) {
                                  return new Date(updatedBalances[member.phoneNumber || member.phone_number].lastActivity).toLocaleDateString();
                                }
                                // Try member's last activity date
                                if (member.lastActivityDate || member.last_activity_date) {
                                  return new Date(member.lastActivityDate || member.last_activity_date).toLocaleDateString();
                                }
                                // If no real activity date available, show "Sin actividad" instead of today's date
                                return "Sin actividad";
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                          <p className="text-sm font-bold text-green-600">
                            ${formatBalance(
                              updatedBalances[member.phoneNumber || member.phone_number]?.balance || 
                              member.currentBalanceDollars || 
                              member.current_balance_dollars
                            )}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewAccount(member.phoneNumber || member.phone_number)}
                              disabled={loadingAccounts.has(member.phoneNumber || member.phone_number)}
                              className="h-6 w-6 p-0"
                              title="Ver cuenta"
                            >
                              {loadingAccounts.has(member.phoneNumber || member.phone_number) ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Eye className="h-2.5 w-2.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateAccount(member.phoneNumber || member.phone_number)}
                              disabled={updatingAccounts.has(member.phoneNumber || member.phone_number)}
                              className="h-6 w-6 p-0"
                              title="Actualizar"
                            >
                              {updatingAccounts.has(member.phoneNumber || member.phone_number) ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-2.5 w-2.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsUsed(member.phoneNumber || member.phone_number)}
                              disabled={markingMember === (member.phoneNumber || member.phone_number)}
                              className={`h-6 w-6 p-0 ${markedAccounts.has(member.phoneNumber || member.phone_number) ? 'border-green-500 bg-green-50 hover:bg-green-100' : 'hover:bg-gray-100'}`}
                              title={markedAccounts.has(member.phoneNumber || member.phone_number) ? "Click para desmarcar" : "Click para marcar como usada"}
                            >
                              {markingMember === (member.phoneNumber || member.phone_number) ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin text-gray-500" />
                              ) : markedAccounts.has(member.phoneNumber || member.phone_number) ? (
                                <Check className="h-2.5 w-2.5 text-green-600 font-bold" />
                              ) : (
                                <div className="w-2 h-2 border border-gray-400 rounded-full" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderHistoryContent = () => {
    // Sort member history: unmarked accounts first, marked accounts last
    const sortedHistory = (memberHistory || []).sort((a: any, b: any) => {
      const phoneA = a.phoneNumber;
      const phoneB = b.phoneNumber;
      const isMarkedA = markedAccounts.has(phoneA);
      const isMarkedB = markedAccounts.has(phoneB);
      
      // If both marked or both unmarked, maintain original order
      if (isMarkedA === isMarkedB) return 0;
      
      // Put unmarked accounts first (return -1 if A is unmarked and B is marked)
      return isMarkedA ? 1 : -1;
    });
    
    const totalPages = Math.ceil(sortedHistory.length / 25);
    const startIndex = (historyPageIndex - 1) * 25;
    const endIndex = startIndex + 25;
    const currentMembers = sortedHistory.slice(startIndex, endIndex);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            {/* Desktop Layout */}
            <div className="hidden sm:flex items-center justify-between">
              <div>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-[16px]">
                  <Users className="h-5 w-5" />
                  Cuentas Verificadas
                </CardTitle>
                <CardDescription>
                  {memberHistory?.length || 0} cuentas verificadas encontradas
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateAllAccounts(currentMembers)}
                  className="min-w-[120px]"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar Todas
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Página</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={tempPageInput}
                    onChange={(e) => {
                      setTempPageInput(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handlePageNavigation(e.currentTarget.value, totalPages);
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      handlePageNavigation(e.currentTarget.value, totalPages);
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600">de {totalPages}</span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPageIndex(prev => Math.max(1, prev - 1))}
                    disabled={historyPageIndex === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setHistoryPageIndex(prev => Math.min(totalPages, prev + 1))}
                    disabled={historyPageIndex === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Mobile Layout - Stacked */}
            <div className="block sm:hidden space-y-3">
              <div>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  Cuentas Verificadas
                </CardTitle>
                <CardDescription className="text-xs">
                  {memberHistory?.length || 0} cuentas encontradas
                </CardDescription>
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateAllAccounts(currentMembers)}
                  className="text-xs h-7 px-2"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Pág</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={tempPageInput}
                      onChange={(e) => {
                        setTempPageInput(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handlePageNavigation(e.currentTarget.value, totalPages);
                          e.currentTarget.blur();
                        }
                      }}
                      onBlur={(e) => {
                        handlePageNavigation(e.currentTarget.value, totalPages);
                      }}
                      className="w-10 px-1 py-1 text-xs border border-gray-300 rounded text-center focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="text-xs text-gray-600">/{totalPages}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPageIndex(prev => Math.max(1, prev - 1))}
                      disabled={historyPageIndex === 1}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistoryPageIndex(prev => Math.min(totalPages, prev + 1))}
                      disabled={historyPageIndex === totalPages}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingHistory ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto" />
                <p className="text-gray-500 mt-2">Cargando cuentas...</p>
              </div>
            ) : currentMembers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay cuentas verificadas disponibles
              </div>
            ) : (
              <div className="space-y-3">
                {currentMembers.map((member: any) => (
                  <div
                    key={`${member.phoneNumber}-${member.id}`}
                    className={`rounded-lg p-4 border-l-4 hover:shadow-md transition-shadow ${
                      markedAccounts.has(member.phoneNumber) 
                        ? 'bg-gradient-to-r from-green-50 to-green-100 border-green-200' 
                        : 'bg-gradient-to-r from-slate-50 to-gray-50 border-blue-500'
                    }`}
                  >
                    {/* Desktop Layout - Horizontal */}
                    <div className="hidden sm:flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-bold text-green-600">
                          ${formatBalance(
                            updatedBalances[member.phoneNumber]?.balance || 
                            member.currentBalanceDollars
                          )}
                        </div>
                        <div className="h-8 w-px bg-gray-300"></div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {member.memberName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {member.phoneNumber}
                          </div>
                          <div className="text-xs text-gray-400">
                            Última actividad: {(() => {
                              // Try updated balances first
                              if (updatedBalances[member.phoneNumber]?.lastActivity) {
                                return new Date(updatedBalances[member.phoneNumber].lastActivity).toLocaleDateString();
                              }
                              // Try member's last activity date
                              if (member.lastActivityDate) {
                                return new Date(member.lastActivityDate).toLocaleDateString();
                              }
                              // If no real activity date available, show "Sin actividad" instead of today's date
                              return "Sin actividad";
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewAccount(member.phoneNumber)}
                          disabled={loadingMember === member.phoneNumber}
                          className="p-2"
                          title="Ver cuenta"
                        >
                          {loadingMember === member.phoneNumber ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateAccount(member.phoneNumber)}
                          disabled={updatingAccounts.has(member.phoneNumber)}
                          className="p-2"
                          title="Actualizar balance"
                        >
                          {updatingAccounts.has(member.phoneNumber) ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsUsed(member.phoneNumber)}
                          disabled={markingMember === member.phoneNumber}
                          className={`p-2 ${markedAccounts.has(member.phoneNumber) ? 'border-green-500 bg-green-50 hover:bg-green-100' : 'hover:bg-gray-100'}`}
                          title={markedAccounts.has(member.phoneNumber) ? "Cuenta marcada como usada" : "Marcar como usada"}
                        >
                          {markingMember === member.phoneNumber ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                          ) : markedAccounts.has(member.phoneNumber) ? (
                            <Check className="h-4 w-4 text-green-600 font-bold" />
                          ) : (
                            <div className="w-3 h-3 border-2 border-gray-400 rounded-full" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Mobile Layout - Low Profile */}
                    <div className="block sm:hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-medium text-blue-600">
                              {(member.memberName || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-xs truncate">{member.memberName}</p>
                            <p className="text-xs text-gray-500 truncate">{member.phoneNumber}</p>
                            <p className="text-xs text-gray-400 truncate">
                              {(() => {
                                // Try updated balances first
                                if (updatedBalances[member.phoneNumber]?.lastActivity) {
                                  return new Date(updatedBalances[member.phoneNumber].lastActivity).toLocaleDateString();
                                }
                                // Try member's last activity date
                                if (member.lastActivityDate) {
                                  return new Date(member.lastActivityDate).toLocaleDateString();
                                }
                                // If no real activity date available, show "Sin actividad" instead of today's date
                                return "Sin actividad";
                              })()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                          <p className="text-sm font-bold text-green-600">
                            ${formatBalance(
                              updatedBalances[member.phoneNumber]?.balance || 
                              member.currentBalanceDollars
                            )}
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewAccount(member.phoneNumber)}
                              disabled={loadingMember === member.phoneNumber}
                              className="h-6 w-6 p-0"
                              title="Ver cuenta"
                            >
                              {loadingMember === member.phoneNumber ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <Eye className="h-2.5 w-2.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateAccount(member.phoneNumber)}
                              disabled={updatingAccounts.has(member.phoneNumber)}
                              className="h-6 w-6 p-0"
                              title="Actualizar"
                            >
                              {updatingAccounts.has(member.phoneNumber) ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-2.5 w-2.5" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleMarkAsUsed(member.phoneNumber)}
                              disabled={markingMember === member.phoneNumber}
                              className={`h-6 w-6 p-0 ${markedAccounts.has(member.phoneNumber) ? 'border-green-500 bg-green-50 hover:bg-green-100' : 'hover:bg-gray-100'}`}
                              title={markedAccounts.has(member.phoneNumber) ? "Usada" : "Marcar"}
                            >
                              {markingMember === member.phoneNumber ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin text-gray-500" />
                              ) : markedAccounts.has(member.phoneNumber) ? (
                                <Check className="h-2.5 w-2.5 text-green-600 font-bold" />
                              ) : (
                                <div className="w-2 h-2 border border-gray-400 rounded-full" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // Client menu items (for member account navigation)
  const clientMenuItems = [
    { id: 'overview', label: 'Resumen', icon: Home },
    { id: 'rewards', label: 'Recompensas', icon: DollarSign },
    { id: 'programs', label: 'Programas', icon: Award },
    { id: 'offers', label: 'Ofertas', icon: Gift },
    { id: 'preferences', label: 'Preferencias', icon: Settings },
    { id: 'raw', label: 'Datos Raw', icon: ShoppingCart },
  ];



  // Render client account content
  const renderClientContent = () => {
    if (!selectedMember) return null;

    console.log('🔥 DASHBOARD RENDER - selectedMember:', selectedMember);
    console.log('🔥 RENDERINGCLIENTCONTENT - ENTERED renderClientContent function');
    
    // FORCE FRESH DATA: Always use fresh API data when available
    const hasFreshData = selectedMember.memberData && (selectedMember.memberData.CardNumber || selectedMember.isFreshData);
    
    let memberData, lookupData, profile, rewardData, matchProfile, phoneList, programList;
    
    if (hasFreshData) {
      console.log('🔥 DASHBOARD RENDER - USING FRESH API DATA');
      console.log('🔥 FRESH memberData:', selectedMember.memberData);
      console.log('🔥 FRESH lookupData:', selectedMember.lookupData);
      
      // For fresh API data, use the passed structure
      memberData = selectedMember.memberData || {};
      lookupData = selectedMember.lookupData || {};
      
      profile = memberData;
      rewardData = memberData.Reward || {};
      matchProfile = lookupData.matchProfiles?.[0] || {};
      phoneList = memberData.PhoneList?.Phone || [];
      programList = memberData.ProgramPrefList?.Preference || [];
      
      console.log('🔥 EXTRACTED profile.CardNumber:', profile.CardNumber);
      console.log('🔥 EXTRACTED matchProfile.zipCode:', matchProfile.zipCode);
      console.log('🔥 EXTRACTED rewardData.CurrentBalance:', rewardData.CurrentBalance);
    } else {
      console.log('🔥 DASHBOARD RENDER - FALLBACK TO CACHED DATA');
      // For cached data, use the stored structure
      profile = selectedMember.profile || {};
      const rawMemberData = selectedMember.rawMemberData || {};
      rewardData = {
        CurrentBalanceDollars: parseFloat(profile.balance || rawMemberData.currentBalanceDollars || '0'),
        CurrentBalance: parseInt(rawMemberData.currentBalance || '0'),
        LastActivityDate: rawMemberData.lastAccessedAt || ''
      };
      matchProfile = {
        firstName: profile.name?.split(' ')[0] || '',
        lastName: profile.name?.split(' ').slice(1).join(' ') || '',
        loyaltyCardNumber: profile.cardNumber || '',
        zipCode: selectedMember.rawLookupData?.matchProfiles?.[0]?.zipCode || ''
      };
      phoneList = selectedMember.phoneNumber ? [{
        AreaCode: selectedMember.phoneNumber.slice(0, 3),
        Number: selectedMember.phoneNumber.slice(3)
      }] : [];
      programList = [];
    }
    
    console.log('🔥 DASHBOARD RENDER - Final Card Number:', profile.CardNumber || matchProfile.loyaltyCardNumber);
    console.log('🔥 DASHBOARD RENDER - Final Zip Code:', matchProfile.zipCode);
    console.log('🔥 DASHBOARD RENDER - Final Last Activity:', rewardData.LastActivityDate);
    console.log('🔥 DASHBOARD RENDER - Final Points:', rewardData.CurrentBalance);
    console.log('🔥 DASHBOARD RENDER - selectedMember.phoneNumber:', selectedMember.phoneNumber);
    console.log('🔥 DASHBOARD RENDER - selectedMember full object:', selectedMember);

    // Get phone number from selectedMember or URL
    const currentPhoneNumber = selectedMember.phoneNumber || 
      (typeof window !== 'undefined' ? window.location.pathname.split('/')[3] : '') ||
      sessionStorage.getItem('memberPhone') || '';

    console.log('🔥 DASHBOARD RENDER - currentPhoneNumber:', currentPhoneNumber);
    console.log('🔥 DASHBOARD RENDER - clientMenuActive:', clientMenuActive);
    console.log('🔥 DASHBOARD RENDER - selectedMember exists:', !!selectedMember);

    switch (clientMenuActive) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Header with name and number */}
            <div className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Resumen</h2>
                  <p className="text-sm text-gray-600">
                    {profile.Name?.FirstName || matchProfile.firstName} {profile.Name?.LastName || matchProfile.lastName} - {profile.CardNumber || matchProfile.loyaltyCardNumber}
                  </p>
                </div>
                {currentPhoneNumber && (
                  <Button
                    variant={markedAccounts.has(currentPhoneNumber) ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleMarkAsUsed(currentPhoneNumber)}
                    disabled={markingMember === currentPhoneNumber}
                    className={`shrink-0 ${markedAccounts.has(currentPhoneNumber) ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    {markingMember === currentPhoneNumber ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : markedAccounts.has(currentPhoneNumber) ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span className="ml-2">
                      {markedAccounts.has(currentPhoneNumber) ? 'Marcada' : 'Marcar como Usada'}
                    </span>
                  </Button>
                )}
              </div>
            </div>

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <User className="h-8 w-8 text-blue-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-blue-900">Miembro</p>
                      <p className="text-lg font-bold text-blue-800 truncate">
                        {profile.Name?.FirstName || matchProfile.firstName} {profile.Name?.LastName || matchProfile.lastName}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <CreditCard className="h-8 w-8 text-green-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-green-900">Tarjeta</p>
                      <p className="text-lg font-bold text-green-800 font-mono">
                        {profile.CardNumber || matchProfile.loyaltyCardNumber || 'N/A'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <DollarSign className="h-8 w-8 text-purple-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-purple-900">Balance</p>
                      <p className="text-lg font-bold text-purple-800">
                        ${(rewardData?.CurrentBalanceDollars ?? rewardData?.CurrentBalance / 1000)?.toFixed(2) ?? '0.00'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <MapPin className="h-8 w-8 text-orange-600" />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-orange-900">Código Postal</p>
                      <p className="text-lg font-bold text-orange-800">{profile.Address?.ZipCode || matchProfile?.zipCode || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Información Personal - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Información Personal */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Información Personal</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Nombre:</span>
                    <span className="col-span-2 text-gray-900">
                      {profile.Name?.FirstName || matchProfile.firstName} {profile.Name?.LastName || matchProfile.lastName}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Email:</span>
                    <span className="col-span-2 text-gray-900 truncate">
                      {profile.EMailAddress?.EMailAddress || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Teléfono:</span>
                    <span className="col-span-2 text-gray-900">
                      {phoneList[0] ? `(${phoneList[0].AreaCode}) ${phoneList[0].Number.slice(0, 3)}-${phoneList[0].Number.slice(3)}` : 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Estado:</span>
                    <span className="col-span-2">
                      <Badge variant="secondary">{profile.MemberStatus || 'Activo'}</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Código Postal:</span>
                    <span className="col-span-2 text-gray-900">
                      {profile.Address?.ZipCode || selectedMember?.rawLookupData?.profile?.zipCode || matchProfile?.zipCode || selectedMember?.rawLookupData?.matchProfiles?.[0]?.zipCode || 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Recompensas */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Recompensas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Balance:</span>
                    <span className="col-span-2 text-2xl font-bold text-green-600">
                      ${rewardData?.CurrentBalanceDollars?.toFixed(2) ?? '0.00'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Puntos:</span>
                    <span className="col-span-2 text-gray-900 font-semibold">
                      {rewardData?.CurrentBalance?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Última Actividad:</span>
                    <span className="col-span-2 text-gray-900">
                      {rewardData?.LastActivityDate ? new Date(rewardData.LastActivityDate).toLocaleDateString('es-ES') : 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Expiración:</span>
                    <span className="col-span-2 text-orange-600 font-medium">
                      {rewardData?.ProjectedForfeitDate ? new Date(rewardData.ProjectedForfeitDate).toLocaleDateString('es-ES') : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>



            {/* Bottom Section - Two Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cronología de Cuenta */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Cronología de Cuenta</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Fecha de Lanzamiento CEP:</span>
                    <span className="col-span-2 text-gray-900">
                      {profile.CEPLaunchDttm || 'Apr 16, 2021'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Última Consulta:</span>
                    <span className="col-span-2 text-gray-900">
                      {new Date().toLocaleDateString('es-ES')} {new Date().toLocaleTimeString('es-ES')}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">ID de Sesión:</span>
                    <span className="col-span-2 text-xs font-mono">
                      {selectedMember.encLoyaltyId ? selectedMember.encLoyaltyId.slice(-8) : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Servicio de Crédito */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold">Servicio de Crédito</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Criterio de Elegibilidad:</span>
                    <span className="col-span-2 text-gray-900">N</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Propensity Amount:</span>
                    <span className="col-span-2 text-gray-900">$40</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Estado de Aplicación:</span>
                    <span className="col-span-2">
                      <Badge variant="destructive">DECLINED</Badge>
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <span className="text-gray-600 font-medium">Acor ID:</span>
                    <span className="col-span-2 text-xs font-mono">AHVALCCYNQ564272635</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      case 'rewards':
        return (
          <div className="space-y-4">
            {/* Top row - Resumen de Recompensas y Próximas Expiraciones lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Resumen de Recompensas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Balance Actual:</span>
                    <span className="text-lg font-bold text-green-600">
                      ${rewardData?.CurrentBalanceDollars?.toFixed(2) ?? '0.00'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Puntos Totales:</span>
                    <span className="text-sm font-medium">
                      {rewardData?.CurrentBalance?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Última Actividad:</span>
                    <span className="text-sm font-medium">
                      {rewardData?.LastActivityDate ? new Date(rewardData.LastActivityDate).toLocaleDateString('es-ES') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Fecha de Expiración:</span>
                    <span className="text-sm font-medium text-orange-600">
                      {rewardData?.ProjectedForfeitDate ? new Date(rewardData.ProjectedForfeitDate).toLocaleDateString('es-ES') : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">SmartPrompt:</span>
                    <Badge variant={rewardData?.SmartPrompt ? "default" : "secondary"}>
                      {rewardData?.SmartPrompt ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Redención Habilitada:</span>
                    <Badge variant={!rewardData?.RedemptionDisabled ? "default" : "destructive"}>
                      {!rewardData?.RedemptionDisabled ? "Sí" : "No"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Próximas Expiraciones */}
              {profile.PointsExpirations && profile.PointsExpirations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Próximas Expiraciones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {profile.PointsExpirations.slice(0, 5).map((expiration, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                          <div>
                            <span className="font-medium text-green-600">${expiration.Dollars}</span>
                            <span className="text-xs text-gray-500 ml-2">({expiration.Points} puntos)</span>
                          </div>
                          <span className="text-xs text-red-600 font-medium">
                            {new Date(expiration.ExpiresOn).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Rx Threshold Info */}
            {rewardData?.RxThreshold && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Información de Prescripciones</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Recetas Requeridas:</span>
                    <span className="text-sm font-medium">
                      {rewardData.RxThreshold.ScriptsTo}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Puntos Otorgados:</span>
                    <span className="text-sm font-medium">
                      {rewardData.RxThreshold.PointsAwarded}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Dólares Otorgados:</span>
                    <span className="text-sm font-medium text-green-600">
                      ${rewardData.RxThreshold.DollarsAwarded}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Redemption Schedule */}
            {rewardData.RedemptionSchedule && rewardData.RedemptionSchedule.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Opciones de Redención</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {rewardData.RedemptionSchedule.map((option, index) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg text-center">
                        <div className="text-lg font-bold text-blue-600">${option.Amount}</div>
                        <div className="text-xs text-gray-600">{option.Points} puntos</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      case 'programs':
        return (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Programas Suscritos</CardTitle>
                <CardDescription>
                  {programList.length} programa{programList.length !== 1 ? 's' : ''} activo{programList.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {programList.length > 0 ? (
                    programList
                      .sort((a, b) => {
                        // Ordenar por fecha más reciente primero
                        const dateA = new Date(a.LastOptInDate || a.EffectiveStartDate || a.EnrollmentStartDate || '1970-01-01');
                        const dateB = new Date(b.LastOptInDate || b.EffectiveStartDate || b.EnrollmentStartDate || '1970-01-01');
                        return dateB.getTime() - dateA.getTime(); // Más nuevo primero
                      })
                      .map((program, index) => (
                      <div key={index} className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="font-semibold text-blue-900 text-base mb-1">
                              {program.Name || program.ProgramHeadline || 'Programa sin título'}
                            </div>
                            <div className="text-sm text-gray-700 mb-2">
                              {program.Description || program.ProgramSecondLine || 'Sin descripción'}
                            </div>
                            {program.Detail && (
                              <div className="text-xs text-gray-600 mb-2 italic">{program.Detail}</div>
                            )}
                            {program.ProgramThirdLine && (
                              <div className="text-xs text-gray-600 mb-2">{program.ProgramThirdLine}</div>
                            )}
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <Badge variant={program.GlobalFlag ? "default" : "secondary"} className="text-xs">
                              {program.GlobalFlag ? "Global" : "Local"}
                            </Badge>
                            <Badge variant={program.SubscriptionInd === 'Y' ? "default" : "outline"} className="text-xs">
                              {program.SubscriptionInd === 'Y' ? 'Suscrito' : 'No Suscrito'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-blue-200">
                          <div className="space-y-2">
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Código:</span> {program.Code || 'N/A'}
                            </div>
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Tipo:</span> {program.Type || 'N/A'}
                            </div>
                            {program.Value && (
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Valor:</span> {program.Value}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Inicio:</span> {program.EffectiveStartDate ? new Date(program.EffectiveStartDate).toLocaleDateString('es-ES') : (program.StartDate ? new Date(program.StartDate).toLocaleDateString('es-ES') : 'N/A')}
                            </div>
                            <div className="text-xs text-gray-600">
                              <span className="font-medium">Vencimiento:</span> {program.EffectiveEndDate ? new Date(program.EffectiveEndDate).toLocaleDateString('es-ES') : 'N/A'}
                            </div>
                            {program.LastOptInDate && (
                              <div className="text-xs text-gray-600">
                                <span className="font-medium">Última inscripción:</span> {new Date(program.LastOptInDate).toLocaleDateString('es-ES')}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {(program.EnrollmentStartDate || program.EnrollmentEndDate) && (
                          <div className="mt-3 pt-2 border-t border-blue-100">
                            <div className="text-xs text-gray-500">
                              <span className="font-medium">Período de inscripción:</span> 
                              {program.EnrollmentStartDate && (
                                <span> Desde {new Date(program.EnrollmentStartDate).toLocaleDateString('es-ES')}</span>
                              )}
                              {program.EnrollmentEndDate && (
                                <span> hasta {new Date(program.EnrollmentEndDate).toLocaleDateString('es-ES')}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 mb-4">
                        <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-500 text-sm">No hay programas activos</p>
                      <p className="text-xs text-gray-400 mt-1">Los programas aparecerán aquí cuando estén disponibles</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );
      case 'offers':
        return <OffersSection encLoyaltyId={selectedMember?.encLoyaltyId} />;
      case 'preferences':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Preferencias del Usuario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Consentimiento MyWag:</span>
                <Badge variant={profile.Preferences?.MyWagConsentInd ? "default" : "secondary"}>
                  {profile.Preferences?.MyWagConsentInd ? "Sí" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Email Consentimiento:</span>
                <Badge variant={profile.Preferences?.EMailConsentInd ? "default" : "secondary"}>
                  {profile.Preferences?.EMailConsentInd ? "Sí" : "No"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Estado Email:</span>
                <Badge variant={profile.Preferences?.EMailValidStatus === "VERIFIED" ? "default" : "secondary"}>
                  {profile.Preferences?.EMailValidStatus || "N/A"}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Recibos Digitales:</span>
                <Badge variant={profile.Preferences?.DigitalReceiptInd === "DIGITAL" ? "default" : "secondary"}>
                  {profile.Preferences?.DigitalReceiptInd || "N/A"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      case 'raw':
        return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Datos Raw de la API</CardTitle>
              <CardDescription>
                Datos completos sin procesar de la API de Walgreens
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96">
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(selectedMember, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Sección no encontrada</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Esta sección no existe.</p>
            </CardContent>
          </Card>
        );
    }
  };

  const renderDashboardContent = () => {
    // Use real dashboard statistics from the API instead of local calculations
    const totalMembers = dashboardStats?.totalAccounts || 0;
    const membersWithBalance = dashboardStats?.accountsWithBalance || 0;
    const totalBalance = dashboardStats?.totalBalance || 0;
    const markedCount = dashboardStats?.usedAccounts || 0;
    
    console.log('📊 Using dashboard stats:', { totalMembers, membersWithBalance, totalBalance, markedCount });

    return (
      <div className="space-y-6">
        {/* Stats Cards - Mobile Optimized */}
        <div className="mobile-stats gap-4">
          <Card className="mobile-stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cuentas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mobile-text-balance">{totalMembers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Cuentas verificadas
              </p>
            </CardContent>
          </Card>

          <Card className="mobile-stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Con Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mobile-text-balance">{membersWithBalance.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {((membersWithBalance / totalMembers) * 100).toFixed(1)}% del total
              </p>
            </CardContent>
          </Card>

          <Card className="mobile-stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mobile-text-balance text-green-600">
                ${formatBalance(totalBalance)}
              </div>
              <p className="text-xs text-muted-foreground">
                En recompensas disponibles
              </p>
            </CardContent>
          </Card>

          <Card className="mobile-stat-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cuentas Usadas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="mobile-text-balance">{markedCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {((markedCount / totalMembers) * 100).toFixed(1)}% marcadas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Acciones Rápidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 justify-start">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 px-3 py-2"
                onClick={() => {
                  navigate('/admin/all-accounts');
                  setSidebarOpen(false);
                }}
              >
                <Users className="h-4 w-4" />
                <span className="text-sm">Ver Cuentas</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 px-3 py-2"
                onClick={() => {
                  navigate('/admin/search');
                  setSidebarOpen(false);
                }}
              >
                <Search className="h-4 w-4" />
                <span className="text-sm">Buscar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 px-3 py-2"
                onClick={() => {
                  navigate('/admin/fast-scan');
                  setSidebarOpen(false);
                }}
              >
                <Target className="h-4 w-4" />
                <span className="text-sm">Verificar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 px-3 py-2"
                onClick={() => {
                  setSelectedMember(null);
                  navigate('/admin/today-activity');
                }}
              >
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Hoy</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>
              Últimas 10 cuentas en la base de datos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mobile-spacing">
              {isLoadingRecent ? (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                  <p className="text-xs text-gray-500 mt-2">Cargando actividad reciente...</p>
                </div>
              ) : recentActivity && recentActivity.length > 0 ? (
                recentActivity.slice(0, 10).map((member, index) => (
                  <div key={`${member.phoneNumber}-${index}`} className="mobile-list-item bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-sm sm:text-base font-medium text-blue-600">
                          {member.memberName?.charAt(0) || 'U'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mobile-text-body font-medium truncate">{member.memberName}</div>
                        <div className="text-xs text-gray-500">{member.phoneNumber}</div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="mobile-text-body font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                        ${formatBalance(member.currentBalanceDollars || member.current_balance_dollars)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {member.lastAccessedAt ? new Date(member.lastAccessedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <Activity className="h-12 w-12 mx-auto" />
                  </div>
                  <p className="text-gray-500 text-sm">No hay actividad reciente</p>
                  <p className="text-xs text-gray-400 mt-1">Las cuentas accedidas aparecerán aquí</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Listen for toggle-sidebar event from header
  useEffect(() => {
    const handleToggleSidebar = () => {
      console.log('Toggle sidebar event received in control panel');
      setSidebarOpen(prev => !prev);
    };

    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    
    return () => {
      window.removeEventListener('toggle-sidebar', handleToggleSidebar);
    };
  }, []); // Remove sidebarOpen dependency to avoid re-adding listener

  const renderContent = () => {
    // If a member is selected, show client content
    if (selectedMember) {
      console.log('🔥 RENDER: Selected member exists, showing client content:', selectedMember.profile?.name);
      return renderClientContent();
    }
    
    console.log('🔥 RENDER: No selected member, showing admin content for tab:', currentTab);
    
    // Otherwise show admin content
    switch (currentTab) {
      case 'dashboard':
        return renderDashboardContent();
      case 'accounts':
        return renderAccountsContent();
      case 'accounts-50-plus':
        return renderAccounts50PlusContent();
      case 'accounts-20-plus':
        return renderAccounts20PlusContent();
      case 'accounts-10-plus':
        return renderAccounts10PlusContent();
      case 'accounts-5-plus':
        return renderAccounts5PlusContent();
      case 'new-accounts':
        return renderNewAccountsContent();
      case 'all-accounts':
        return renderAllAccountsContent();
      case 'history':
        return renderHistoryContent();
      case 'search':
        return renderSearchContent();
      case 'today-activity':
        return renderTodayActivityContent();
      case 'balance-rewards':
        return <BalanceRewardsSimple />;
      case 'api-keys':
        return <APIKeyPoolStats />;
      case 'settings':
        return renderSettingsContent();
      case 'scanner':
        return <Scanner />;

      default:
        return renderDashboardContent();
    }
  };

  return (
    <AdminShell>
      {renderContent()}
    </AdminShell>
  );
}