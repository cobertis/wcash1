import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResumeJobModal } from './resume-job-modal';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  DollarSign,
  Activity,
  FileText,
  TrendingUp,
  Database,
  Timer,
  Loader2
} from 'lucide-react';

interface JobExecutionHistoryProps {
  selectedJobId?: string;
  onSelectJob?: (jobId: string) => void;
}

export function JobExecutionHistory({ selectedJobId, onSelectJob }: JobExecutionHistoryProps) {
  const [restartingJobs, setRestartingJobs] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('overview');
  const [resumingJob, setResumingJob] = useState<string | null>(null);
  // Toast removed - using console.log instead

  // Fetch job execution history
  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['/api/job-execution-history'],
    queryFn: async () => {
      const response = await fetch('/api/job-execution-history');
      if (!response.ok) throw new Error('Failed to fetch job execution history');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Fetch incomplete jobs that can be resumed
  const { data: incompleteJobs, isLoading: incompleteJobsLoading } = useQuery({
    queryKey: ['/api/job-execution-history/incomplete'],
    queryFn: async () => {
      const response = await fetch('/api/job-execution-history/incomplete');
      if (!response.ok) throw new Error('Failed to fetch incomplete jobs');
      return response.json();
    },
    refetchInterval: 5000,
  });

  // Fetch specific job details
  const { data: jobDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['/api/job-execution-history', selectedJobId],
    queryFn: async () => {
      if (!selectedJobId) return null;
      const response = await fetch(`/api/job-execution-history/${selectedJobId}`);
      if (!response.ok) throw new Error('Failed to fetch job details');
      return response.json();
    },
    enabled: !!selectedJobId,
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallido</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Procesando</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'text-green-600';
      case 'invalid': return 'text-red-600';
      case 'error': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const handleResumeJobSuccess = () => {
    // Refetch jobs after successful resume
    window.location.reload();
  };

  if (jobsLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Database className="h-8 w-8 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-600">No hay historial de trabajos ejecutados</p>
          <p className="text-sm text-gray-500 mt-2">
            Los trabajos de verificación en lotes aparecerán aquí después de ejecutarse
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Historial de Trabajos Ejecutados
        </h2>
        <Badge variant="outline" className="text-sm">
          {jobs.length} trabajo{jobs.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="incomplete">Incompletos</TabsTrigger>
          <TabsTrigger value="details">Detalles</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4">
            {jobs.map((job: any) => (
              <Card key={job.id} className={`cursor-pointer transition-all hover:shadow-md ${
                selectedJobId === job.jobId ? 'ring-2 ring-blue-500' : ''
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{job.jobName}</CardTitle>
                        <p className="text-sm text-gray-600">{job.description}</p>
                      </div>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{job.totalPhoneNumbers}</div>
                      <div className="text-xs text-gray-500">Total Números</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{job.validAccounts}</div>
                      <div className="text-xs text-gray-500">Válidas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">{job.invalidAccounts}</div>
                      <div className="text-xs text-gray-500">Inválidas</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">${job.totalBalanceDollars}</div>
                      <div className="text-xs text-gray-500">Balance Total</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(job.executedAt)}
                    </div>
                    <div className="flex items-center gap-1">
                      <Timer className="h-4 w-4" />
                      {job.executionTime ? formatDuration(job.executionTime) : 'N/A'}
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4" />
                      {job.apiCallsUsed} API calls
                    </div>
                  </div>

                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                      Entorno: {job.environment === 'deployed' ? 'Producción' : 'Desarrollo'}
                    </div>
                    <div className="flex gap-2">
                      {job.status === 'processing' && (
                        <ResumeJobModal
                          jobId={job.jobId}
                          jobName={job.jobName}
                          onResumeSuccess={handleResumeJobSuccess}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                          >
                            <Activity className="h-4 w-4 mr-2" />
                            Reanudar
                          </Button>
                        </ResumeJobModal>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectJob?.(job.jobId)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Ver Detalles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="incomplete" className="space-y-4">
          {incompleteJobsLoading ? (
            <div className="space-y-4">
              {[...Array(2)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !incompleteJobs || incompleteJobs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-8 w-8 mx-auto mb-4 text-green-400" />
                <p className="text-gray-600">No hay trabajos incompletos</p>
                <p className="text-sm text-gray-500 mt-2">
                  Todos los trabajos se han completado exitosamente
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="bg-orange-50 border-l-4 border-orange-400 p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-orange-400 mr-2" />
                  <div className="text-sm text-orange-700">
                    <p><strong>Trabajos Incompletos:</strong> Estos trabajos se interrumpieron y pueden ser reanudados.</p>
                    <p className="mt-1">🔄 <strong>Solución Automática:</strong> Haga clic en "Reiniciar Automáticamente" para continuar desde donde se detuvo. El sistema recuperará automáticamente los números originales de la base de datos.</p>
                    <p className="mt-1 text-xs">📋 <strong>Información:</strong> Trabajo 1: 3,616 números (0 procesados) • Trabajo 2: 1,164 números (0 procesados)</p>
                  </div>
                </div>
              </div>

              {incompleteJobs.map((job: any) => (
                <Card key={job.id} className="border-l-4 border-orange-400">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <Timer className="h-4 w-4 text-orange-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{job.jobName}</CardTitle>
                          <p className="text-sm text-gray-600">{job.description}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                        Interrumpido
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{job.totalPhoneNumbers}</div>
                        <div className="text-xs text-gray-500">Total Números</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{job.processedCount}</div>
                        <div className="text-xs text-gray-500">Procesados</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">{job.remainingCount}</div>
                        <div className="text-xs text-gray-500">Restantes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {Math.round((job.processedCount / job.totalPhoneNumbers) * 100)}%
                        </div>
                        <div className="text-xs text-gray-500">Completado</div>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                      <div 
                        className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(job.processedCount / job.totalPhoneNumbers) * 100}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        Iniciado: {formatDate(job.executedAt)}
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4" />
                        {job.apiCallsUsed} API calls usadas
                      </div>
                    </div>

                    <div className="mt-4 flex justify-between items-center">
                      <div className="text-xs text-gray-500">
                        Entorno: {job.environment === 'deployed' ? 'Producción' : 'Desarrollo'}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                          disabled={restartingJobs.has(job.jobId)}
                          onClick={async () => {
                            try {
                              setRestartingJobs(prev => new Set(prev).add(job.jobId));
                              
                              // Use production endpoint in deployed environment
                              const isProduction = window.location.hostname.includes('.replit.app') || 
                                                  window.location.hostname.includes('.replit.dev') ||
                                                  window.location.hostname === 'localhost';
                              
                              const endpoint = isProduction ? 
                                `/api/bulk-verify/restart/${job.jobId}/production` : 
                                `/api/bulk-verify/restart/${job.jobId}`;
                              
                              const response = await fetch(endpoint, {
                                method: 'POST',
                              });
                              
                              const result = await response.json();
                              
                              if (result.success) {
                                if (result.alreadyProcessed) {
console.log("Toast removed");
                                } else {
console.log("Toast removed");
                                  window.location.reload();
                                }
                              } else {
console.log("Toast removed");
                              }
                            } catch (error) {
                              console.error('Error restarting job:', error);
console.log("Toast removed");
                            } finally {
                              setRestartingJobs(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(job.jobId);
                                return newSet;
                              });
                            }
                          }}
                        >
                          {restartingJobs.has(job.jobId) ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Activity className="h-4 w-4 mr-2" />
                          )}
                          {restartingJobs.has(job.jobId) ? 'Reiniciando...' : 'Reiniciar Automáticamente'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectJob?.(job.jobId)}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Ver Detalles
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedJobId && jobDetails ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Detalles del Trabajo: {jobDetails.jobName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Estado</label>
                      <div className="mt-1">{getStatusBadge(jobDetails.status)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Fecha de Ejecución</label>
                      <div className="mt-1 text-sm text-gray-900">{formatDate(jobDetails.executedAt)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tiempo de Ejecución</label>
                      <div className="mt-1 text-sm text-gray-900">
                        {jobDetails.executionTime ? formatDuration(jobDetails.executionTime) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Llamadas API</label>
                      <div className="mt-1 text-sm text-gray-900">{jobDetails.apiCallsUsed}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Estadísticas</label>
                      <div className="mt-2 grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-lg font-bold text-green-600">{jobDetails.statistics.valid}</div>
                          <div className="text-xs text-green-700">Válidas</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 rounded-lg">
                          <div className="text-lg font-bold text-red-600">{jobDetails.statistics.invalid}</div>
                          <div className="text-xs text-red-700">Inválidas</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">{jobDetails.statistics.withBalance}</div>
                          <div className="text-xs text-purple-700">Con Balance</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">${jobDetails.statistics.averageBalance.toFixed(2)}</div>
                          <div className="text-xs text-blue-700">Balance Promedio</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {jobDetails.notes && (
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <label className="text-sm font-medium text-gray-700">Notas</label>
                    <div className="mt-1 text-sm text-gray-900">{jobDetails.notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Selecciona un trabajo para ver sus detalles</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {selectedJobId && jobDetails && jobDetails.results ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Resultados Detallados ({jobDetails.results.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {jobDetails.results.map((result: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {result.memberName || 'No encontrado'}
                          </p>
                          <p className="text-xs text-gray-500">{result.phoneNumber}</p>
                          {result.currentBalanceDollars && result.currentBalanceDollars !== '0.00' && (
                            <p className="text-xs text-green-600 font-medium">
                              ${result.currentBalanceDollars} disponible
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={result.status === 'valid' ? 'default' : 'destructive'}
                          className={result.status === 'valid' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {result.status === 'valid' ? 'Válida' : 
                           result.status === 'invalid' ? 'Inválida' : 'Error'}
                        </Badge>
                        {result.apiResponseTime && (
                          <p className="text-xs text-gray-500 mt-1">
                            {result.apiResponseTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Database className="h-8 w-8 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600">Selecciona un trabajo para ver sus resultados</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}