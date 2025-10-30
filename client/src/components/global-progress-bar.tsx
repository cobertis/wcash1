import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface BulkUpdateProgress {
  type: 'bulk_update_progress' | 'bulk_update_complete';
  current: number;
  total: number;
  phoneNumber?: string;
  category?: string;
  totalUpdated?: number;
}

export default function GlobalProgressBar() {
  const [globalUpdateInProgress, setGlobalUpdateInProgress] = useState(false);
  const [globalUpdateProgress, setGlobalUpdateProgress] = useState({ current: 0, total: 0 });
  const [updatingCategory, setUpdatingCategory] = useState<string>('');

  useEffect(() => {
    // Listen for bulk update progress
    const handleBulkProgress = (event: CustomEvent<BulkUpdateProgress>) => {
      const data = event.detail;
      console.log('📊 BULK UPDATE PROGRESS:', data);
      
      if (data.type === 'bulk_update_progress') {
        setGlobalUpdateInProgress(true);
        setGlobalUpdateProgress({ current: data.current, total: data.total });
        if (data.category) {
          setUpdatingCategory(data.category);
        }
      } else if (data.type === 'bulk_update_complete') {
        console.log('✅ BULK UPDATE COMPLETE:', data);
        setGlobalUpdateInProgress(false);
        setGlobalUpdateProgress({ current: 0, total: 0 });
        setUpdatingCategory('');
      }
    };

    window.addEventListener('bulkUpdateProgress', handleBulkProgress as EventListener);
    
    return () => {
      window.removeEventListener('bulkUpdateProgress', handleBulkProgress as EventListener);
    };
  }, []);

  if (!globalUpdateInProgress) {
    return null;
  }

  return (
    <div className="w-full bg-blue-500 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
        <span className="font-medium">
          Actualizando {updatingCategory || 'cuentas'}: {globalUpdateProgress.current}/{globalUpdateProgress.total}
        </span>
      </div>
      <Button
        onClick={() => {
          console.log('🛑 USER CANCELLED: Sending cancellation request');
          fetch('/api/member-history/cancel-bulk-update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          }).then(() => {
            console.log('✅ Cancellation request sent');
          });
        }}
        variant="destructive"
        size="sm"
        className="bg-red-600 hover:bg-red-700 text-white border-0 shadow-md px-2 py-1 h-7 text-xs"
      >
        <X className="h-3 w-3 mr-1" />
        Cancelar
      </Button>
    </div>
  );
}