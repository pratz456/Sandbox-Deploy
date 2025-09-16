'use client';

import { useJobProgress } from '@/lib/hooks/useJobProgress';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';

interface JobProgressProps {
  accountId: string;
  onComplete?: () => void;
}

export function JobProgress({ accountId, onComplete }: JobProgressProps) {
  const { job, error, loading } = useJobProgress(accountId);
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="text-xl font-semibold">Setting up analysis...</div>
        <Progress value={0} className="w-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="text-red-600 font-semibold">Error loading progress</div>
        <div className="text-sm text-gray-600">
          {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="text-gray-600">Setting up analysis...</div>
      </div>
    );
  }

  const { processed = 0, total = 0, status, avgMs = 0, succeeded = 0, failed = 0 } = job;
  const pct = job.total ? Math.round((job.processed / job.total) * 100) : 0;

  // ETA calculation: only show if we have at least a few processed items & a nonzero avg
  const remaining = Math.max(job.total - job.processed, 0);
  const etaSec = (job.processed >= 3 && job.avgMs > 0) ? Math.ceil((remaining * job.avgMs) / 1000) : null;

  const getStatusMessage = () => {
    switch (status) {
      case 'running':
        return 'AI Analysis in Progress';
      case 'done':
        return 'Analysis Complete!';
      case 'failed':
        return 'Analysis Failed';
      case 'canceled':
        return 'Analysis Canceled';
      default:
        return 'Analysis Status Unknown';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'done':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'canceled':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case 'done':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'canceled':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <h3 className="text-lg font-semibold">AI Analysis Progress</h3>
      <Progress value={pct} className="my-2 w-64" />
      <p className="text-sm text-gray-700">{job.processed} of {job.total} analyzed</p>
      {etaSec != null && (
        <p className="text-sm text-gray-600">Estimated time remaining: ~{etaSec} sec</p>
      )}
      {job.status === 'done' && (
        <Button 
          onClick={() => {
            if (onComplete) {
              onComplete();
            } else {
              router.push(`/protected/review?accountId=${accountId}`);
            }
          }}
          className="mt-3"
        >
          Review Transactions
        </Button>
      )}
    </div>
  );
}
