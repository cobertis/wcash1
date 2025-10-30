import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  FileText,
  X,
  Loader2,
  Activity
} from "lucide-react";

interface UploadProgressData {
  processed: number;
  total: number;
  added: number;
  skipped: number;
  message: string;
  errors?: string[];
  isComplete?: boolean;
  startTime?: Date;
}

interface UploadProgressWindowProps {
  isOpen: boolean;
  onClose: () => void;
  progress: UploadProgressData | null;
  isUploading: boolean;
}

export function UploadProgressWindow({ 
  isOpen, 
  onClose, 
  progress, 
  isUploading 
}: UploadProgressWindowProps) {
  if (!isOpen) return null;

  const getElapsedTime = () => {
    if (!progress?.startTime) return "0s";
    const elapsed = Math.floor((Date.now() - progress.startTime.getTime()) / 1000);
    if (elapsed < 60) return `${elapsed}s`;
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}m ${seconds}s`;
  };

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const getEstimatedTimeRemaining = () => {
    if (!progress || progress.processed === 0 || progress.total === 0) return "Calculando...";
    const elapsed = progress.startTime ? Date.now() - progress.startTime.getTime() : 0;
    const rate = progress.processed / (elapsed / 1000);
    const remaining = (progress.total - progress.processed) / rate;
    
    if (remaining < 60) return `${Math.round(remaining)}s restantes`;
    const minutes = Math.floor(remaining / 60);
    const seconds = Math.round(remaining % 60);
    return `${minutes}m ${seconds}s restantes`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              ) : (
                <Upload className="h-5 w-5 text-blue-500" />
              )}
              Subida de Números de Teléfono
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onClose}
              disabled={isUploading}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            {isUploading ? "Procesando números..." : "Subida completada"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {progress && (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    Progreso General
                  </span>
                  <span className="text-sm text-gray-500">
                    {getProgressPercentage()}%
                  </span>
                </div>
                <Progress 
                  value={getProgressPercentage()} 
                  className="h-3"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{progress.processed} de {progress.total} procesados</span>
                  <span>{isUploading ? getEstimatedTimeRemaining() : "Completado"}</span>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-medium text-blue-600">
                      Procesados
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-blue-900">
                    {progress.processed}
                  </div>
                </div>

                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600">
                      Agregados
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-green-900">
                    {progress.added}
                  </div>
                </div>

                <div className="bg-yellow-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-600">
                      Omitidos
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-900">
                    {progress.skipped}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <span className="text-xs font-medium text-gray-600">
                      Tiempo
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {getElapsedTime()}
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-800">
                    Estado Actual
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {progress.message}
                </p>
              </div>

              {/* Errors Section */}
              {progress.errors && progress.errors.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      Errores Encontrados ({progress.errors.length})
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {progress.errors.map((error, index) => (
                      <div key={index} className="text-xs text-red-700 bg-red-100 p-2 rounded">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Total: {progress.total}
                  </Badge>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    ✓ {progress.added}
                  </Badge>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    ⚠ {progress.skipped}
                  </Badge>
                </div>
                <div className="text-sm text-gray-600">
                  {progress.isComplete ? "Completado" : "En progreso..."}
                </div>
              </div>

              {/* Action Buttons */}
              {progress.isComplete && (
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={onClose}
                    className="flex-1"
                  >
                    Cerrar
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}