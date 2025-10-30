import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export interface BackgroundJob {
  id: string;
  phoneNumbers: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalNumbers: number;
  processedNumbers: number;
  results: any[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export function useBackgroundJobs() {
  const [pollingInterval, setPollingInterval] = useState<number | false>(false);

  // Fetch all jobs
  const { data: jobs = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/bulk-verify/jobs'],
    queryFn: async () => {
      const response = await fetch('/api/bulk-verify/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json() as Promise<BackgroundJob[]>;
    },
    refetchInterval: pollingInterval,
  });

  // Fetch active jobs only
  const { data: activeJobs = [] } = useQuery({
    queryKey: ['/api/bulk-verify/active'],
    queryFn: async () => {
      const response = await fetch('/api/bulk-verify/active');
      if (!response.ok) throw new Error('Failed to fetch active jobs');
      return response.json() as Promise<BackgroundJob[]>;
    },
    refetchInterval: pollingInterval,
  });

  // Start polling when there are active jobs
  useEffect(() => {
    const hasActiveJobs = activeJobs.length > 0;
    setPollingInterval(hasActiveJobs ? 2000 : false); // Poll every 2 seconds
  }, [activeJobs.length]);

  const startBulkVerification = async (phoneNumbers: string[]): Promise<string> => {
    const response = await fetch('/api/bulk-verify/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumbers }),
    });

    if (!response.ok) {
      throw new Error('Failed to start bulk verification');
    }

    const result = await response.json();
    
    // Start polling after starting a job
    setPollingInterval(2000);
    refetch();
    
    return result.jobId;
  };

  const deleteJob = async (jobId: string): Promise<void> => {
    const response = await fetch(`/api/bulk-verify/jobs/${jobId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete job');
    }

    refetch();
  };

  const getJobById = (jobId: string): BackgroundJob | undefined => {
    return jobs.find(job => job.id === jobId);
  };

  const completedJobs = jobs.filter(job => job.status === 'completed');
  const failedJobs = jobs.filter(job => job.status === 'failed');

  return {
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    isLoading,
    startBulkVerification,
    deleteJob,
    getJobById,
    refetch,
  };
}