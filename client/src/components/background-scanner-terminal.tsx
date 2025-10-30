import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Play, Pause, Activity, Clock, CheckCircle2, XCircle, Upload, FileText, BarChart3, Loader2, RefreshCw, StopCircle, Settings } from 'lucide-react';

interface ScannerStats {
  processed: number;
  total: number;
  valid: number;
  invalid: number;
  currentNumber: string;
  isRunning: boolean;
  startTime: string | null;
  endTime: string | null;
}

export function BackgroundScannerTerminal() {
  const [stats, setStats] = useState<ScannerStats>({
    processed: 0,
    total: 0,
    valid: 0,
    invalid: 0,
    currentNumber: '',
    isRunning: false,
    startTime: null,
    endTime: null
  });
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentTab, setCurrentTab] = useState<'scanner' | 'upload' | 'queue' | 'stats'>('scanner');
  const [bulkNumbers, setBulkNumbers] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [queueData, setQueueData] = useState<any[]>([]);
  const [showProgressWindow, setShowProgressWindow] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    processed: number;
    total: number;
    added: number;
    skipped: number;
    message: string;
    errors?: string[];
    isComplete?: boolean;
    startTime?: Date;
  } | null>(null);
  
  // NEW: Intelligent API system states
  const [apiStats, setApiStats] = useState<{
    totalKeys: number;
    maxThroughput: number;
    activeKeys: Array<{ name: string; requestCount: number; maxRequests: number; availableRequests: number }>;
  } | null>(null);
  const [isParallelProcessing, setIsParallelProcessing] = useState(false);
  const [parallelJobId, setParallelJobId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  
  // Toast removed
  const terminalRef = React.useRef<HTMLDivElement>(null);

  // Detect production environment
  useEffect(() => {
    const hostname = window.location.hostname;
    const isProductionEnv = hostname.includes('replit.app') || hostname.includes('repl.co');
    setIsProduction(isProductionEnv);
    console.log(`Environment detected: ${isProductionEnv ? 'PRODUCTION' : 'DEVELOPMENT'}`);
  }, []);

  // Setup WebSocket connection for real-time logs
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    let ws: WebSocket;

    const connectWebSocket = () => {
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('🔌 WebSocket connected');
        setWsConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const timestamp = message.timestamp || new Date().toLocaleTimeString();
          
          switch (message.type) {
            case 'job_started':
              setLogs(prev => [...prev, `[${timestamp}] 🚀 PROCESAMIENTO PARALELO INICIADO`]);
              setIsParallelProcessing(true);
              setParallelJobId(message.jobId);
              break;
            case 'scanner_started':
              setLogs(prev => [...prev, `[${timestamp}] 🚀 PROCESAMIENTO PARALELO INICIADO`]);
              break;
            case 'progress':
              setStats(prev => ({
                ...prev,
                processed: message.processed,
                valid: message.valid,
                invalid: message.invalid,
                currentNumber: message.currentNumber || ''
              }));
              break;
            case 'job_completed':
              setLogs(prev => [...prev, `[${timestamp}] ✅ PROCESAMIENTO COMPLETADO - ${message.valid} cuentas válidas encontradas`]);
              setIsParallelProcessing(false);
              setParallelJobId(null);
              console.log("Toast removed: Procesamiento completado");
              break;
            case 'job_stopped':
              setLogs(prev => [...prev, `[${timestamp}] ⏹️ PROCESAMIENTO DETENIDO`]);
              setIsParallelProcessing(false);
              setParallelJobId(null);
              break;
            case 'account_found':
              setLogs(prev => [...prev, `[${timestamp}] 💰 CUENTA ENCONTRADA: ${message.memberName} - $${message.balance}`]);
              console.log("Toast removed: Nueva cuenta encontrada");
              break;
            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected, reconnecting...');
        setWsConnected(false);
        setTimeout(connectWebSocket, 2000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // Fetch scanner stats periodically
  useEffect(() => {
    if (!isProduction) return;
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/background-scanner/stats');
        if (response.ok) {
          const data = await response.json();
          setStats({
            processed: data.processed || 0,
            total: data.total || 0,
            valid: data.valid || 0,
            invalid: data.invalid || 0,
            currentNumber: data.currentNumber || '',
            isRunning: data.isRunning || false,
            startTime: data.startTime || null,
            endTime: data.endTime || null
          });
          
          if (data.isRunning && data.currentNumber) {
            setLogs(prev => [
              ...prev.slice(-50), // Keep last 50 logs
              `[${new Date().toLocaleTimeString()}] 🔍 Escaneando ${data.currentNumber} (${data.processed}/${data.total})`
            ]);
          }
        }
      } catch (error) {
        console.error('Error fetching scanner stats:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isProduction]);

  // NEW: Fetch API pool stats for intelligent system (only in production)
  useEffect(() => {
    if (!isProduction) return;
    
    const fetchApiStats = async () => {
      try {
        const response = await fetch('/api/api-pool/stats');
        const data = await response.json();
        
        // Get active keys information for intelligent processing
        const activeKeysResponse = await fetch('/api/api-pool/active-keys');
        const activeKeys = activeKeysResponse.ok ? await activeKeysResponse.json() : [];
        
        setApiStats({
          totalKeys: data.totalKeys,
          maxThroughput: data.totalKeys * 300, // 300 requests per minute per key
          activeKeys: activeKeys
        });
      } catch (error) {
        console.error('Error fetching API stats:', error);
      }
    };

    fetchApiStats();
    const interval = setInterval(fetchApiStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [isProduction]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleStart = async () => {
    if (!isProduction) {
      console.log("Toast removed: Función no disponible - El procesamiento paralelo solo está disponible en producción");
      return;
    }
    
    setIsStarting(true);
    try {
      console.log('🚀 Iniciando procesamiento paralelo de alta velocidad...');
      
      // SIMPLIFIED: Use the dedicated background scanner endpoint
      const response = await fetch('/api/background-scanner/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start parallel processing');
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log(`Toast removed: Procesamiento Paralelo Iniciado - Procesando ${result.totalNumbers} números con capacidad de 1200 req/min`);
        
        console.log('✅ Sistema de procesamiento paralelo activado con éxito');
        
        // Update state to show parallel processing is active
        setIsParallelProcessing(true);
        setParallelJobId(result.jobId);
        
        setLogs(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] 🚀 PROCESAMIENTO PARALELO INICIADO`,
          `[${new Date().toLocaleTimeString()}] 📊 ${result.totalNumbers} números en cola para procesar`,
          `[${new Date().toLocaleTimeString()}] ⚡ Capacidad: ${apiStats?.maxThroughput || 1200} requests/minuto`,
          `[${new Date().toLocaleTimeString()}] 🔑 Usando ${apiStats?.totalKeys || 4} API keys simultáneamente`
        ]);
      } else {
        console.log(`Toast removed: Error - ${result.message}`);
      }
      
    } catch (error) {
      console.error('Error starting parallel processing:', error);
      console.log(`Toast removed: Error - ${error instanceof Error ? error.message : "Error al iniciar procesamiento paralelo"}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    if (!isProduction) {
      console.log("Toast removed: Función no disponible - Las funciones del scanner solo están disponibles en producción");
      return;
    }
    
    setIsStopping(true);
    try {
      const response = await fetch('/api/background-scanner/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("Toast removed: Scanner detenido - El escaneo ha sido detenido");
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⏹️ Scanner detenido por el usuario`]);
      } else {
        console.log(`Toast removed: Error - ${data.message}`);
      }
    } catch (error) {
      console.log("Toast removed: Error - Error al detener el scanner");
    } finally {
      setIsStopping(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const response = await fetch('/api/background-scanner/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        console.log("Toast removed: Scanner reseteado - El scanner ha sido reseteado y está listo para reprocesar todos los números");
        setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔄 Scanner reseteado - listo para reprocesar`]);
      } else {
        console.log(`Toast removed: Error - ${data.message}`);
      }
    } catch (error) {
      console.log("Toast removed: Error - Error al resetear el scanner");
    } finally {
      setIsResetting(false);
    }
  };

  const handleUploadNumbers = async () => {
    if (!bulkNumbers.trim()) {
      console.log("Toast removed: Error - Por favor ingresa números de teléfono");
      return;
    }

    setIsUploading(true);
    try {
      // Parse and validate phone numbers with smart normalization
      const phoneNumbers = bulkNumbers
        .split(/[\n,]/)
        .map(num => {
          const cleaned = num.trim().replace(/\D/g, '');
          
          // Smart normalization logic
          if (cleaned.length === 11) {
            if (cleaned.startsWith('1')) {
              // Remove first digit (country code)
              return cleaned.substring(1);
            } else {
              // Remove last digit
              return cleaned.slice(0, -1);
            }
          } else if (cleaned.length === 10) {
            return cleaned;
          }
          
          return ''; // Skip invalid numbers
        })
        .filter(num => num.length === 10);
      
      if (phoneNumbers.length === 0) {
        console.log("Toast removed: Error - No se encontraron números de teléfono válidos");
        return;
      }
      
      // Rest of upload logic...
      setUploadProgress({
        processed: 0,
        total: phoneNumbers.length,
        added: 0,
        skipped: 0,
        message: "Iniciando subida...",
        startTime: new Date()
      });
      
      setShowProgressWindow(true);
      
      const response = await fetch('/api/phone-numbers-queue/bulk-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers })
      });

      if (response.ok) {
        const result = await response.json();
        setUploadProgress(prev => prev ? {
          ...prev,
          processed: result.totalProcessed,
          added: result.added,
          skipped: result.skipped,
          message: `Completado: ${result.added} agregados, ${result.skipped} omitidos`,
          isComplete: true
        } : null);
        console.log("Toast removed: Números subidos exitosamente");
        setBulkNumbers('');
      } else {
        console.log("Toast removed: Error subiendo números");
      }
    } catch (error) {
      console.log("Toast removed: Error durante la subida");
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setShowProgressWindow(false);
        setUploadProgress(null);
      }, 3000);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Scanner de Números de Teléfono
            {wsConnected && (
              <span className="text-green-500 text-sm">• WebSocket conectado</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as 'scanner' | 'upload' | 'queue' | 'stats')}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="scanner">Scanner</TabsTrigger>
              <TabsTrigger value="upload">Subir</TabsTrigger>
              <TabsTrigger value="queue">Cola</TabsTrigger>
              <TabsTrigger value="stats">Estadísticas</TabsTrigger>
            </TabsList>

            <TabsContent value="scanner" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {stats.isRunning ? (
                        <>
                          <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm text-green-600">Ejecutándose</span>
                        </>
                      ) : (
                        <>
                          <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                          <span className="text-sm text-gray-600">Detenido</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Progreso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress value={stats.total > 0 ? (stats.processed / stats.total) * 100 : 0} />
                      <p className="text-sm text-muted-foreground">
                        {stats.processed} / {stats.total} procesados
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Resultados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600">Válidos:</span>
                        <span>{stats.valid}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600">Inválidos:</span>
                        <span>{stats.invalid}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleStart} 
                  disabled={isStarting || stats.isRunning || !isProduction}
                  className="flex items-center gap-2"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Iniciar
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleStop} 
                  disabled={isStopping || !stats.isRunning || !isProduction}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isStopping ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deteniendo...
                    </>
                  ) : (
                    <>
                      <StopCircle className="h-4 w-4" />
                      Detener
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleReset} 
                  disabled={isResetting || stats.isRunning}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Reseteando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Resetear
                    </>
                  )}
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Terminal</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    ref={terminalRef}
                    className="bg-gray-900 text-green-400 p-4 rounded-md h-64 overflow-y-auto font-mono text-xs"
                  >
                    {logs.length === 0 ? (
                      <p className="text-gray-500">Sistema listo. Presiona 'Iniciar' para comenzar el escaneo...</p>
                    ) : (
                      logs.map((log, index) => (
                        <div key={index} className="mb-1">{log}</div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Subir Números</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="bulkNumbers">Números de teléfono (uno por línea)</Label>
                    <Textarea
                      id="bulkNumbers"
                      value={bulkNumbers}
                      onChange={(e) => setBulkNumbers(e.target.value)}
                      placeholder="2234567890&#10;3345678901&#10;..."
                      className="h-32"
                    />
                  </div>
                  <Button
                    onClick={handleUploadNumbers}
                    disabled={isUploading}
                    className="flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Subir Números
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="queue" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Estado de la Cola</CardTitle>
                </CardHeader>
                <CardContent>
                  {queueStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{queueStats.total}</div>
                        <div className="text-sm text-blue-600">Total</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-600">{queueStats.pending}</div>
                        <div className="text-sm text-yellow-600">Pendientes</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{queueStats.processed}</div>
                        <div className="text-sm text-green-600">Procesados</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No hay datos de cola disponibles</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Estadísticas del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                  {apiStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium">API Keys</h4>
                        <div className="text-2xl font-bold text-blue-600">{apiStats.totalKeys}</div>
                        <p className="text-sm text-muted-foreground">Total de keys activas</p>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-medium">Throughput Máximo</h4>
                        <div className="text-2xl font-bold text-green-600">{apiStats.maxThroughput}</div>
                        <p className="text-sm text-muted-foreground">Requests por minuto</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Estadísticas no disponibles</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Progress Dialog */}
      <Dialog open={showProgressWindow} onOpenChange={setShowProgressWindow}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progreso de Subida</DialogTitle>
          </DialogHeader>
          {uploadProgress && (
            <div className="space-y-4">
              <Progress value={uploadProgress.total > 0 ? (uploadProgress.processed / uploadProgress.total) * 100 : 0} />
              <div className="space-y-2">
                <p><strong>Procesados:</strong> {uploadProgress.processed} / {uploadProgress.total}</p>
                <p><strong>Agregados:</strong> {uploadProgress.added}</p>
                <p><strong>Omitidos:</strong> {uploadProgress.skipped}</p>
                <p><strong>Estado:</strong> {uploadProgress.message}</p>
                {uploadProgress.isComplete && (
                  <p className="text-green-600 font-medium">✅ Completado</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}