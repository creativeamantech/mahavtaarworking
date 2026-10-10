import { useState, useEffect, useRef } from 'react';
import { LoanRecord } from '../types/domain';

type PivotType = 'buildCityPivot' | 'buildTeamPivot' | 'buildCrossTab' | 'buildBucketCityPivot' | 'buildExecCityPivot';

export function useWorkerPivot<T>(type: PivotType, records: LoanRecord[], targets: Record<string, number> = {}, fallbackResult: T) {
  const [data, setData] = useState<T>(fallbackResult);
  const [isCalculating, setIsCalculating] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(new URL('../lib/pivot.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current.onmessage = (e) => {
      const { result, success, error } = e.data;
      if (success) {
        setData(result as T);
      } else {
        console.error(`Worker error (${type}):`, error);
      }
      setIsCalculating(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [type]);

  useEffect(() => {
    if (!workerRef.current || !records || records.length === 0) {
      if (!records || records.length === 0) {
        setData(fallbackResult);
        setIsCalculating(false);
      }
      return;
    }

    setIsCalculating(true);
    workerRef.current.postMessage({
      id: Date.now(),
      type,
      payload: { records, targets },
    });
  }, [records, targets, type]);

  return { data, isCalculating };
}
