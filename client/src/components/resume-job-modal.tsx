import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Activity, AlertCircle, FileText } from 'lucide-react';

interface ResumeJobModalProps {
  jobId: string;
  jobName: string;
  onResumeSuccess?: () => void;
  children: React.ReactNode;
}

export function ResumeJobModal({ jobId, jobName, onResumeSuccess, children }: ResumeJobModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumbers, setPhoneNumbers] = useState('');
  const [isResuming, setIsResuming] = useState(false);
  // Toast removed - using console.log instead

  const handleResumeJob = async () => {
    setIsResuming(true);
    
    try {
      // Use the automatic restart endpoint instead of manual resume
      // Use production endpoint in deployed environment
      const isProduction = window.location.hostname.includes('.replit.app') || 
                          window.location.hostname.includes('.replit.dev') ||
                          window.location.hostname === 'localhost';
      
      const endpoint = isProduction ? 
        `/api/bulk-verify/restart/${jobId}/production` : 
        `/api/bulk-verify/restart/${jobId}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to restart job');
      }

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

      setIsOpen(false);
      setPhoneNumbers('');
      onResumeSuccess?.();
      
    } catch (error) {
      console.error('Error restarting job:', error);
console.log("Toast removed");
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Reiniciar Trabajo: {jobName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-green-600">
            <Activity className="h-5 w-5" />
            <span className="text-sm">
              Este trabajo será reiniciado automáticamente usando generación inteligente de números.
            </span>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Reinicio Automático</h4>
            <p className="text-sm text-blue-800">
              El sistema generará automáticamente números de teléfono apropiados basado en el tamaño del trabajo original 
              y omitirá números ya procesados para evitar duplicados.
            </p>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isResuming}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleResumeJob}
              disabled={isResuming}
              className="bg-green-600 hover:bg-green-700"
            >
              {isResuming ? (
                <>
                  <Activity className="h-4 w-4 mr-2 animate-spin" />
                  Reiniciando...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4 mr-2" />
                  Reiniciar Automáticamente
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}