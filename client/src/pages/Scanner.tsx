import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  CheckCircle,
  UserCheck,
  XCircle,
  Play,
  Square,
  Upload,
  Download,
  Trash2,
  Activity,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";

interface ScannerStatus {
  isScanning: boolean;
  totalPending: number;
  totalProcessed: number;
  totalValid: number;
  totalInvalid: number;
  apiKeysActive: number;
  requestsPerSecond: number;
  estimatedTimeRemaining?: number;
}

interface ScanFile {
  id: number;
  filename: string;
  uploadedAt: string;
  totalNumbers: number;
  processedNumbers: number;
  validNumbers: number;
  status: 'pending' | 'processing' | 'completed' | 'queued' | 'error';
  errorMessage?: string;
}

interface ScanResult {
  id: number;
  phoneNumber: string;
  memberName: string;
  balance: number;
  lastActivity: string;
  scannedAt: string;
  status: 'valid' | 'invalid';
}

export default function Scanner() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const limit = 50;
  
  // WebSocket connection for real-time updates
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectWebSocket = () => {
      try {
        // Get the WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/fast-scan-progress`;
        
        console.log('🔌 Connecting to Scanner WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        ws.onopen = () => {
          console.log('✅ Scanner WebSocket connected');
          setWsConnected(true);
          reconnectAttempts = 0;
          toast({
            title: "WebSocket conectado",
            description: "Recibiendo actualizaciones en tiempo real",
          });
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📡 WebSocket message:', message.type);
            
            switch (message.type) {
              case 'scanner:progress':
                // Invalidate status query to update UI
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
                break;
                
              case 'scanner:started':
                toast({
                  title: "Scanner iniciado",
                  description: "El proceso de escaneo ha comenzado",
                });
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
                break;
                
              case 'scanner:stopped':
                toast({
                  title: "Scanner detenido",
                  description: `Escaneados: ${message.data.totalScanned}, Válidos: ${message.data.validFound}`,
                });
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/files'] });
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/results'] });
                break;
                
              case 'scanner:valid_found':
                toast({
                  title: "✅ Cuenta válida encontrada",
                  description: `${message.data.memberName} - $${message.data.balance}`,
                });
                // Invalidate results to show new valid account
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/results'] });
                // CRITICAL: Invalidate sidebar counters for real-time badge updates
                queryClient.invalidateQueries({ queryKey: ['/api/member-history/sidebar-counters'] });
                // Also invalidate dashboard stats to reflect new account
                queryClient.invalidateQueries({ queryKey: ['/api/member-history/dashboard-stats'] });
                break;
                
              case 'scanner:file_completed':
                toast({
                  title: "📁 Archivo completado",
                  description: `Procesados: ${message.data.totalProcessed}, Válidos: ${message.data.validFound}`,
                });
                queryClient.invalidateQueries({ queryKey: ['/api/scanner/files'] });
                break;
                
              case 'connection_established':
                console.log('🔌 Connection established:', message.message);
                break;
                
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('❌ Scanner WebSocket error:', error);
          setWsConnected(false);
        };
        
        ws.onclose = () => {
          console.log('🔌 Scanner WebSocket disconnected');
          setWsConnected(false);
          wsRef.current = null;
          
          // Attempt reconnection if not manually closed
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`🔄 Attempting reconnection ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, delay);
          } else {
            toast({
              title: "WebSocket desconectado",
              description: "Usando polling como fallback",
              variant: "destructive",
            });
          }
        };
      } catch (error) {
        console.error('❌ Error creating WebSocket:', error);
        setWsConnected(false);
      }
    };
    
    // Connect on mount
    connectWebSocket();
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Only run once on mount

  // Fetch scanner status
  const { data: status, isLoading: statusLoading } = useQuery<ScannerStatus>({
    queryKey: ['/api/scanner/status'],
    refetchInterval: (query) => {
      // Use longer intervals when WebSocket is connected
      if (wsConnected) {
        return query.state.data?.isScanning ? 10000 : 30000;
      }
      // Fallback to polling when WebSocket is disconnected
      return query.state.data?.isScanning ? 1000 : 5000;
    },
  });

  const isScanning = status?.isScanning || false;

  // Fetch API pool stats for accurate capacity calculation
  const { data: poolStats } = useQuery<{ totalKeys: number; totalThroughput: number; poolStats: any[] }>({
    queryKey: ['/api/api-pool/stats'],
    refetchInterval: 3000,
  });

  // Fetch uploaded files
  const { data: files = [], isLoading: filesLoading } = useQuery<ScanFile[]>({
    queryKey: ['/api/scanner/files'],
    refetchInterval: 3000,
  });

  // Fetch scan results
  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['/api/scanner/results', page, limit],
    queryFn: async () => {
      const response = await fetch(`/api/scanner/results?page=${page}&limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch results');
      return response.json();
    },
    refetchInterval: isScanning ? 5000 : false,
  });

  const results = resultsData?.data || [];
  const pagination = resultsData?.pagination || { total: 0, totalPages: 1 };

  // Start scanner mutation
  const processFilesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/scanner/process-files', { method: 'POST' });
    },
    onSuccess: () => {
      toast({
        title: "Archivos procesados",
        description: "Los números han sido extraídos y agregados a la cola.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/files'] });
    },
    onError: (error) => {
      toast({
        title: "Error al procesar archivos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/scanner/start', { method: 'POST' });
    },
    onSuccess: () => {
      toast({
        title: "Scanner iniciado",
        description: "El proceso de escaneo ha comenzado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    },
    onError: (error) => {
      toast({
        title: "Error al iniciar scanner",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop scanner mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/scanner/stop', { method: 'POST' });
    },
    onSuccess: () => {
      toast({
        title: "Scanner detenido",
        description: "El proceso de escaneo se ha detenido correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    },
    onError: (error) => {
      toast({
        title: "Error al detener scanner",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload files mutation
  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/scanner/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Error al subir archivos');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Archivos subidos",
        description: `Se han subido ${data.filesProcessed} archivos con ${data.totalNumbers} números en total.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onError: (error) => {
      toast({
        title: "Error al subir archivos",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: number) => {
      return apiRequest(`/api/scanner/file/${fileId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      toast({
        title: "Archivo eliminado",
        description: "El archivo ha sido eliminado de la cola.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Process single file mutation
  const processFileMutation = useMutation({
    mutationFn: async (fileId: number) => {
      return apiRequest(`/api/scanner/process-file/${fileId}`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Archivo procesado",
        description: `${data.numbersAdded || 0} números agregados a la cola.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/files'] });
      queryClient.invalidateQueries({ queryKey: ['/api/scanner/status'] });
    },
    onError: (error) => {
      toast({
        title: "Error al procesar archivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export results
  const handleExport = async () => {
    try {
      const response = await fetch('/api/scanner/results/export');
      if (!response.ok) throw new Error('Failed to export results');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scan-results-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Resultados exportados",
        description: "Los resultados se han exportado correctamente.",
      });
    } catch (error) {
      toast({
        title: "Error al exportar",
        description: "No se pudieron exportar los resultados.",
        variant: "destructive",
      });
    }
  };

  // Format number with thousand separators
  const formatNumber = (num: number) => {
    return num.toLocaleString('en-US');
  };

  // Format balance as currency
  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate capacity percentage using real data from backend
  // Backend uses 250 req/min per key (not 300) to stay safely under API limits
  const totalKeys = poolStats?.totalKeys || 0;
  const maxCapacity = totalKeys * 250; // Real max capacity based on actual keys
  const currentCapacity = (status?.apiKeysActive || 0) * 250;
  const capacityPercentage = maxCapacity > 0 ? (currentCapacity / maxCapacity) * 100 : 0;

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Enable buttons based on state
  const hasPendingFiles = (files?.some((f: any) => f.status === 'pending') || false);
  const hasNumbersInQueue = (status?.totalPending || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="scanner-title">
            Scanner de Cuentas
          </h1>
          <Badge variant={wsConnected ? "default" : "secondary"} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? "bg-green-500 animate-pulse" : "bg-gray-500"}`} />
            {wsConnected ? "WebSocket Conectado" : "WebSocket Desconectado"}
          </Badge>
        </div>
        <p className="text-muted-foreground" data-testid="scanner-description">
          Escanea números telefónicos para encontrar cuentas válidas
        </p>
      </div>

      {/* Control Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Control del Scanner</span>
            <Badge variant={isScanning ? "default" : "secondary"} className="ml-2">
              {isScanning ? "Scanner Activo" : "Scanner Detenido"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 flex-wrap">
              {/* Process Files Button - only show when there are pending files */}
              {hasPendingFiles && !isScanning && (
                <Button
                  onClick={() => processFilesMutation.mutate()}
                  disabled={processFilesMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-process-files"
                >
                  {processFilesMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Procesar Archivos
                </Button>
              )}
              
              {/* Start/Stop Scanner Buttons */}
              {!isScanning ? (
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || !hasNumbersInQueue}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-start-scanner"
                >
                  {startMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Iniciar Scanner
                </Button>
              ) : (
                <Button
                  onClick={() => stopMutation.mutate()}
                  disabled={stopMutation.isPending}
                  variant="destructive"
                  data-testid="button-stop-scanner"
                >
                  {stopMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Square className="mr-2 h-4 w-4" />
                  )}
                  Detener Scanner
                </Button>
              )}
            </div>
            
            {/* Status Messages */}
            {!isScanning && !hasPendingFiles && !hasNumbersInQueue && (
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="inline mr-1 h-4 w-4" />
                No hay archivos ni números en cola. Sube archivos para comenzar.
              </p>
            )}
            {hasPendingFiles && !hasNumbersInQueue && (
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="inline mr-1 h-4 w-4" />
                Hay {files?.filter((f: any) => f.status === 'pending').length} archivos pendientes. Presiona "Procesar Archivos" para extraer los números.
              </p>
            )}
            {!hasPendingFiles && hasNumbersInQueue && !isScanning && (
              <p className="text-sm text-muted-foreground">
                <AlertCircle className="inline mr-1 h-4 w-4" />
                Hay {formatNumber(status?.totalPending || 0)} números listos. Presiona "Iniciar Scanner" para comenzar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats Dashboard */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Por Escanear</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-pending">
              {statusLoading ? '-' : formatNumber(status?.totalPending || 0)}
            </div>
            <p className="text-xs text-muted-foreground">números pendientes</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escaneadas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-processed">
              {statusLoading ? '-' : formatNumber(status?.totalProcessed || 0)}
            </div>
            <p className="text-xs text-muted-foreground">números procesados</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Válidas</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="stat-valid">
              {statusLoading ? '-' : formatNumber(status?.totalValid || 0)}
            </div>
            <p className="text-xs text-muted-foreground">cuentas válidas</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inválidas</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-invalid">
              {statusLoading ? '-' : formatNumber(status?.totalInvalid || 0)}
            </div>
            <p className="text-xs text-muted-foreground">cuentas inválidas</p>
          </CardContent>
        </Card>
      </div>

      {/* API Capacity Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Capacidad de API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium">APIs Activas</p>
                <p className="text-2xl font-bold" data-testid="api-active">
                  {status?.apiKeysActive || 0} de {totalKeys}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Capacidad</p>
                <p className="text-2xl font-bold" data-testid="api-capacity">
                  {formatNumber(currentCapacity)} req/min de {formatNumber(maxCapacity)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Velocidad</p>
                <p className="text-2xl font-bold" data-testid="api-speed">
                  {status?.requestsPerSecond?.toFixed(1) || '0'} nums/seg
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Uso de capacidad</span>
                <span>{capacityPercentage.toFixed(0)}%</span>
              </div>
              <Progress value={capacityPercentage} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Subir Archivos
          </CardTitle>
          <CardDescription>
            Sube archivos .txt o .csv con números telefónicos (uno por línea)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="file-upload">Archivos</Label>
                <Input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".txt,.csv"
                  ref={fileInputRef}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles(files);
                  }}
                  disabled={uploadMutation.isPending}
                  data-testid="input-file-upload"
                />
              </div>
              {selectedFiles.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {selectedFiles.length} archivo(s) seleccionado(s)
                </div>
              )}
              <Button
                onClick={() => uploadMutation.mutate(selectedFiles)}
                disabled={uploadMutation.isPending || selectedFiles.length === 0}
                data-testid="button-upload-files"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Subir Archivos
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Files Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle>Cola de Archivos</CardTitle>
          <CardDescription>
            Archivos pendientes de procesamiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay archivos en cola
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Procesados</TableHead>
                  <TableHead>Válidos</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Progreso</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const progressPercentage = file.totalNumbers > 0
                    ? (file.processedNumbers / file.totalNumbers) * 100
                    : 0;
                  
                  return (
                    <TableRow key={file.id} data-testid={`file-row-${file.id}`}>
                      <TableCell className="font-medium">{file.filename}</TableCell>
                      <TableCell>{formatNumber(file.totalNumbers)}</TableCell>
                      <TableCell>{formatNumber(file.processedNumbers)}</TableCell>
                      <TableCell>{formatNumber(file.validNumbers)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(file.status)}>
                          {file.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="w-[100px]">
                          <Progress value={progressPercentage} className="h-2" />
                          <span className="text-xs text-muted-foreground">
                            {progressPercentage.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => processFileMutation.mutate(file.id)}
                            disabled={processFileMutation.isPending || isScanning}
                            data-testid={`button-process-file-${file.id}`}
                            title={isScanning ? "Detén el scanner para procesar archivos" : "Procesar archivo manualmente"}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(file.id)}
                            disabled={deleteMutation.isPending || isScanning}
                            data-testid={`button-delete-file-${file.id}`}
                            title={isScanning ? "Detén el scanner para eliminar archivos" : "Eliminar archivo"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Live Results Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Cuentas Válidas Encontradas</CardTitle>
              <CardDescription>
                Últimos resultados del proceso de escaneo
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={handleExport}
              data-testid="button-export-csv"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {resultsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay resultados disponibles
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Última Actividad</TableHead>
                    <TableHead>Escaneado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result: ScanResult) => (
                    <TableRow key={result.id} data-testid={`result-row-${result.id}`}>
                      <TableCell className="font-medium">{result.phoneNumber}</TableCell>
                      <TableCell>{result.memberName || '-'}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(result.balance)}
                      </TableCell>
                      <TableCell>{formatDate(result.lastActivity)}</TableCell>
                      <TableCell>{formatDate(result.scannedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, pagination.total)} de {pagination.total} resultados
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <Select
                      value={String(page)}
                      onValueChange={(value) => setPage(Number(value))}
                    >
                      <SelectTrigger className="w-[100px]" data-testid="select-page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: pagination.totalPages }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>
                            Página {i + 1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === pagination.totalPages}
                      data-testid="button-next-page"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}