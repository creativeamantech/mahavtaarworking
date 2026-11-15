// @ts-nocheck
/**
 * Mahavtaar Ledger - High-Performance Aggregation & Pivot Engine
 * Computes multi-dimensional analytics (City, Team, Bucket, CrossTab) with single-pass complexity.
 */

import { calculateRow, safeNumber } from './calculations';
import { resolveTarget } from './targets';
import { LoanRecord } from '../types/domain';

export interface CityPivotRow {
  city: string;
  state: string;
  collection: number;
  count: number;
  totalPOS: number;
  paid: number;
  paidPOS: number;
  rollbackPOS: number;
  targetPOS: number;
  targetDate?: string;
  pct: number;
  actualPct: number;
  recoveryPct: number;
  rollbackPct: number;
  target: number;
  dailyRequiredPOS: number;
}

export interface BucketCityPivotRow {
  bkt: string | number;
  city: string;
  collection: number;
  count: number;
  totalPOS: number;
  paid: number;
  paidPOS: number;
  posPaidOnlyCount: number;
  posPaidOnlyPOS: number;
  targetPOS: number;
  targetDate?: string;
  target: number;
  pct: number;
  actualPct: number;
  recoveryPct: number;
  dailyRequiredPOS: number;
  cases: { aggr: string, name: string, pos: number, isPaid: boolean }[];
}

export interface ExecCityPivotRow {
  bkt: string | number;
  city: string;
  collection: number;
  count: number;
  totalPOS: number;
  paid: number;
  paidPOS: number;
  posPaidOnlyCount: number;
  posPaidOnlyPOS: number;
  targetPOS: number;
  targetDate?: string;
  target: number;
  pct: number;
  actualPct: number;
  recoveryPct: number;
  dailyRequiredPOS: number;
  cases: { aggr: string, name: string, pos: number, isPaid: boolean }[];
}

export interface TeamPivotRow {
  bkt: string | number;
  exec: string;
  collection: number;
  count: number;
  totalPOS: number;
  paid: number;
  paidPOS: number;
  posPaidOnlyCount: number;
  posPaidOnlyPOS: number;
  targetPOS: number;
  targetDate?: string;
  pct: number;
  actualPct: number;
  recoveryPct: number;
  target: number;
  dailyRequiredPOS: number;
  cases: Array<{ aggr: string; name: string; pos: number; isPaid: boolean }>;
}

export function computeDailyRequiredPOS(targetPOS: number, paidPOS: number, targetDate?: string): number {
  const needed = Math.max(0, targetPOS - paidPOS);
  if (needed <= 0) return 0;
  if (!targetDate) return needed;
  
  const today = new Date().toISOString().split('T')[0];
  const diff = new Date(targetDate).getTime() - new Date(today).getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return needed / (days > 0 ? days : 1);
}

export function buildCityPivot(records: LoanRecord[], targets: Record<string, number> = {}): CityPivotRow[] {
  const map: Record<string, CityPivotRow> = {};

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const c = calculateRow(r);
    const city = (r.city || r.City || 'UNKNOWN').trim().toUpperCase();
    const state = (r.state || r.State || 'UNKNOWN').trim().toUpperCase();
    
    if (!map[city]) {
      map[city] = {
        city,
        state,
        collection: 0,
        count: 0,
        totalPOS: 0,
        paid: 0,
        paidPOS: 0,
        rollbackPOS: 0,
        targetPOS: 0,
        pct: 0,
        rollbackPct: 0,
        target: 0,
        dailyRequiredPOS: 0,
      };
    }
    
    const posVal = safeNumber(r.principal_outstanding ?? r.POS ?? r['Principal Outstanding'] ?? r.amount);
    const dacVal = safeNumber(r.dac ?? r.DAC ?? r['DAC'] ?? r.collection ?? r['Collection']);
    map[city].collection += dacVal;
    map[city].count += 1;
    map[city].totalPOS += posVal;
    if (c.mainPaid === 1) {
      map[city].paid += 1;
      map[city].paidPOS += c.mainPaidPOS || 0;
    }
    map[city].rollbackPOS += c.rollbackPOS || 0;

    const tRes = resolveTarget(targets, { city: r.city || r.City, state: r.state || r.State, bkt: r.bom_bkt });
    map[city].targetPOS += (posVal * tRes.pct) / 100;
    if (tRes.date) map[city].targetDate = tRes.date;
  }

  return Object.values(map)
    .map((item) => {
      const actualPct = item.totalPOS > 0 ? item.paidPOS / item.totalPOS : 0;
      const recoveryPct = item.totalPOS > 0 ? item.collection / item.totalPOS : 0;
      const rollbackPct = item.totalPOS > 0 ? item.rollbackPOS / item.totalPOS : 0;
      const target = Math.max(0, item.targetPOS - item.paidPOS);
      const dailyRequiredPOS = computeDailyRequiredPOS(item.targetPOS, item.paidPOS, item.targetDate);

      return {
        ...item,
        pct: actualPct,
        actualPct,
        recoveryPct,
        rollbackPct,
        target,
        dailyRequiredPOS,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function buildTeamPivot(records: LoanRecord[], targets: Record<string, number> = {}): TeamPivotRow[] {
  const map: Record<string, TeamPivotRow> = {};

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const c = calculateRow(r);
    const exec = (r.executive_name || r['Executive Name'] || 'UNKNOWN').trim();
    const bkt = r.bom_bkt ?? 'UNKNOWN';
    
    const key = `${bkt}__${exec}`;
    if (!map[key]) {
      map[key] = {
        bkt,
        exec,
        collection: 0,
        count: 0,
        totalPOS: 0,
        paid: 0,
        paidPOS: 0,
        posPaidOnlyCount: 0,
        posPaidOnlyPOS: 0,
        targetPOS: 0,
        pct: 0,
        actualPct: 0,
        recoveryPct: 0,
        target: 0,
        dailyRequiredPOS: 0,
        cases: [],
      };
    }

    const posVal = safeNumber(r.principal_outstanding ?? r.POS ?? r['Principal Outstanding'] ?? r.amount);
    const dacVal = safeNumber(r.dac ?? r.DAC ?? r['DAC'] ?? r.collection ?? r['Collection']);
    map[key].collection += dacVal;
    map[key].count += 1;
    map[key].totalPOS += posVal;

    if (c.teamPaid === 1) {
      map[key].paid += 1;
      map[key].paidPOS += c.teamPaidPOS || 0;
    }
    if (c.posCleared <= 0 && c.teamPaid !== 1) {
      map[key].posPaidOnlyCount += 1;
      map[key].posPaidOnlyPOS += posVal;
    }

    const tRes = resolveTarget(targets, { city: r.city || r.City, state: r.state || r.State, bkt: r.bom_bkt });
    map[key].targetPOS += (posVal * tRes.pct) / 100;
    if (tRes.date) map[key].targetDate = tRes.date;
    
    map[key].cases.push({
      aggr: r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || '-',
      name: r.customer_name || r.CUSTOMERNAME || r['Customer Name'] || r.CUSTOMER_NAME || '-',
      pos: posVal,
      isPaid: c.mainPaid === 1,
    });
  }

  return Object.values(map)
    .map((e) => {
      const actualPct = e.totalPOS > 0 ? (e.paidPOS + (e.posPaidOnlyPOS || 0)) / e.totalPOS : 0;
      const recoveryPct = e.totalPOS > 0 ? e.collection / e.totalPOS : 0;
      return { 
        ...e, 
        pct: actualPct,
        actualPct,
        recoveryPct,
        target: Math.max(0, e.targetPOS - e.paidPOS),
        dailyRequiredPOS: computeDailyRequiredPOS(e.targetPOS, e.paidPOS, e.targetDate),
      };
    })
    .sort((a, b) => String(a.bkt).localeCompare(String(b.bkt)) || a.exec.localeCompare(b.exec));
}

export function buildCrossTab(records: LoanRecord[], targets: Record<string, number> = {}) {
  const execSet = new Set<string>();
  const cityCounts: Record<string, number> = {};

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const exec = (r.executive_name || r['Executive Name'] || 'UNKNOWN').trim();
    const city = (r.city || r.City || 'UNKNOWN').trim().toUpperCase();
    execSet.add(exec);
    cityCounts[city] = (cityCounts[city] || 0) + 1;
  }

  const execs = Array.from(execSet).sort();
  const cities = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a]);

  const matrix: Record<string, Record<string, { paidPOS: number; totalPOS: number; targetPOS: number; target: number; targetDate?: string }>> = {};

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const c = calculateRow(r);
    const city = (r.city || r.City || 'UNKNOWN').trim().toUpperCase();
    const exec = (r.executive_name || r['Executive Name'] || 'UNKNOWN').trim();
    
    if (!matrix[city]) matrix[city] = {};
    if (!matrix[city][exec]) {
      matrix[city][exec] = { paidPOS: 0, totalPOS: 0, targetPOS: 0, target: 0 };
    }
    
    const posVal = safeNumber(r.principal_outstanding);
    matrix[city][exec].paidPOS += c.teamPaidPOS || 0;
    matrix[city][exec].totalPOS += posVal;

    const tRes = resolveTarget(targets, { city: r.city || r.City, state: r.state || r.State, bkt: r.bom_bkt });
    matrix[city][exec].targetPOS += (posVal * tRes.pct) / 100;
    if (tRes.date) matrix[city][exec].targetDate = tRes.date;
  }

  // Calculate needed POS (target) for each cell
  for (const city of cities) {
    for (const exec of execs) {
      if (matrix[city] && matrix[city][exec]) {
        matrix[city][exec].target = Math.max(0, matrix[city][exec].targetPOS - matrix[city][exec].paidPOS);
      }
    }
  }

  return { execs, cities, matrix };
}

export function buildBucketCityPivot(records: LoanRecord[], targets: Record<string, number> = {}): BucketCityPivotRow[] {
  const map: Record<string, Omit<BucketCityPivotRow, 'pct' | 'actualPct' | 'recoveryPct' | 'target' | 'dailyRequiredPOS'>> = {};

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const c = calculateRow(r);
    const city = (r.city || r.City || 'UNKNOWN').trim().toUpperCase();
    const bkt = r.bom_bkt ?? 'UNKNOWN';
    
    const key = `${bkt}__${city}`;
    if (!map[key]) {
      map[key] = {
        bkt,
        city,
        collection: 0,
        count: 0,
        totalPOS: 0,
        paid: 0,
        paidPOS: 0,
        posPaidOnlyCount: 0,
        posPaidOnlyPOS: 0,
        targetPOS: 0,
        cases: [],
      };
    }

    const dacVal = safeNumber(r.dac ?? r.DAC ?? r['DAC'] ?? r.collection ?? r['Collection']);
    map[key].collection += dacVal;
    map[key].count += 1;
    const posVal = safeNumber(r.principal_outstanding ?? r.POS ?? r['Principal Outstanding'] ?? r.amount);
    map[key].totalPOS += posVal;

    if (c.mainPaid === 1) {
      map[key].paid += 1;
      map[key].paidPOS += c.mainPaidPOS || 0;
    }

    if (c.posCleared <= 0 && c.mainPaid !== 1) {
      map[key].posPaidOnlyCount += 1;
      map[key].posPaidOnlyPOS += posVal;
    }

    const tRes = resolveTarget(targets, { city: r.city || r.City, state: r.state || r.State, bkt: r.bom_bkt });
    map[key].targetPOS += (posVal * tRes.pct) / 100;
    if (tRes.date) map[key].targetDate = tRes.date;
  }

  return Object.values(map)
    .map((e) => {
      const actualPct = e.totalPOS > 0 ? (e.paidPOS + (e.posPaidOnlyPOS || 0)) / e.totalPOS : 0;
      const recoveryPct = e.totalPOS > 0 ? e.collection / e.totalPOS : 0;
      return { 
        ...e, 
        pct: actualPct,
        actualPct,
        recoveryPct,
        target: Math.max(0, e.targetPOS - e.paidPOS),
        dailyRequiredPOS: computeDailyRequiredPOS(e.targetPOS, e.paidPOS, e.targetDate),
      };
    })
    .sort((a, b) => String(a.bkt).localeCompare(String(b.bkt)) || a.city.localeCompare(b.city));
}

export function buildExecCityPivot(records: LoanRecord[], targets: Record<string, number> = {}): ExecCityPivotRow[] {
  const map: Record<string, Omit<ExecCityPivotRow, 'pct' | 'actualPct' | 'recoveryPct' | 'target' | 'dailyRequiredPOS'>> = {};

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const c = calculateRow(r);
    const city = (r.city || r.City || 'UNKNOWN').trim().toUpperCase();
    const bkt = r.bom_bkt ?? 'UNKNOWN';
    
    const key = `${bkt}__${city}`;
    if (!map[key]) {
      map[key] = {
        bkt,
        city,
        collection: 0,
        count: 0,
        totalPOS: 0,
        paid: 0,
        paidPOS: 0,
        posPaidOnlyCount: 0,
        posPaidOnlyPOS: 0,
        targetPOS: 0,
        cases: [],
      };
    }
    
    const dacVal = safeNumber(r.dac ?? r.DAC ?? r['DAC'] ?? r.collection ?? r['Collection']);
    map[key].collection += dacVal;
    map[key].count += 1;
    
    const posVal = safeNumber(r.principal_outstanding ?? r.POS ?? r['Principal Outstanding'] ?? r.amount);
    map[key].totalPOS += posVal;
    
    const tRes = resolveTarget(targets, { city: r.city || r.City, state: r.state || r.State, bkt: r.bom_bkt });
    map[key].targetPOS += (posVal * tRes.pct) / 100;
    if (tRes.date) map[key].targetDate = tRes.date;
    
    if (c.teamPaid === 1) {
      map[key].paid += 1;
      map[key].paidPOS += c.teamPaidPOS || 0;
    }
    if (c.posCleared <= 0 && c.teamPaid !== 1) {
      map[key].posPaidOnlyCount += 1;
      map[key].posPaidOnlyPOS += posVal;
    }
  }

  return Object.values(map).map((e) => {
    const actualPct = e.totalPOS > 0 ? (e.paidPOS + (e.posPaidOnlyPOS || 0)) / e.totalPOS : 0;
    const recoveryPct = e.totalPOS > 0 ? e.collection / e.totalPOS : 0;
    return {
      ...e,
      pct: actualPct,
      actualPct,
      recoveryPct,
      target: Math.max(0, e.targetPOS - e.paidPOS),
      dailyRequiredPOS: computeDailyRequiredPOS(e.targetPOS, e.paidPOS, e.targetDate),
    };
  });
}


export interface MainPerformanceMetric {
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
  totalPos: number;
  collection: number;
  mainPaidPos: number;
  rollbackPos: number;
  mainPercent: number;
  rollbackPercent: number;
  targetPos: number | null;
  neededPos: number | null;
}
export interface MainPerformanceExecutive extends MainPerformanceMetric { executive: string }
export interface MainPerformanceCity extends MainPerformanceMetric {
  city: string;
  executives: MainPerformanceExecutive[];
}
export interface MainPerformanceBucket {
  bucket: string;
  cities: MainPerformanceCity[];
  total: MainPerformanceMetric;
}

function buildMainMetric(rows: LoanRecord[], targets: Record<string, number>): MainPerformanceMetric {
  let paidCount = 0, totalPos = 0, collection = 0, mainPaidPos = 0, rollbackPos = 0;
  let targetPos = 0, targetedPos = 0;
  for (const r of rows) {
    const c = calculateRow(r);
    const pos = Math.max(0, safeNumber(r.principal_outstanding ?? r.POS ?? r['Principal Outstanding']));
    totalPos += pos;
    collection += safeNumber(r.dac ?? r.DAC ?? r['DAC'] ?? r.collection ?? r['Collection']);
    if (c.mainPaid === 1) {
      paidCount += 1;
      mainPaidPos += c.mainPaidPOS || 0;
    }
    rollbackPos += c.rollbackPOS || 0;
    const t = resolveTarget(targets, { city: r.city || r.City, state: r.state || r.State, bkt: r.bom_bkt ?? r['BOM Bucket'] });
    if (t.pct > 0) {
      targetedPos += pos;
      targetPos += (pos * t.pct) / 100;
    }
  }
  const totalCount = rows.length;
  return {
    totalCount,
    paidCount,
    unpaidCount: Math.max(0, totalCount - paidCount),
    totalPos,
    collection,
    mainPaidPos,
    rollbackPos,
    mainPercent: totalPos > 0 ? (mainPaidPos / totalPos) * 100 : 0,
    rollbackPercent: totalPos > 0 ? (rollbackPos / totalPos) * 100 : 0,
    targetPos: targetedPos > 0 ? targetPos : null,
    neededPos: targetedPos > 0 ? targetPos - mainPaidPos : null,
  };
}

export function buildMainPerformance(records: LoanRecord[], targets: Record<string, number> = {}): MainPerformanceBucket[] {
  const bucketNames = ['Bucket 1', 'Bucket 2', 'Bucket 3', 'Bucket 4', 'Bucket 5'];
  return bucketNames.map((bucket) => {
    const rows = records.filter((r) => {
      const raw = r.bom_bkt ?? r['BOM Bucket'] ?? '';
      return String(raw).trim().toLowerCase().replace(/^bucket\s*/, '').replace(/^b\s*/, '').replace(/[^0-9]/g, '') === bucket.replace('Bucket ', '');
    });
    const cityMap = new Map<string, LoanRecord[]>();
    for (const r of rows) {
      const city = String(r.city || r.City || 'UNKNOWN').trim() || 'UNKNOWN';
      const list = cityMap.get(city) ?? [];
      list.push(r);
      cityMap.set(city, list);
    }
    const cities: MainPerformanceCity[] = [...cityMap.entries()].map(([city, cityRows]) => {
      const executiveMap = new Map<string, LoanRecord[]>();
      for (const r of cityRows) {
        const executive = String(r.executive_name || r['Executive Name'] || 'Unassigned').trim() || 'Unassigned';
        const list = executiveMap.get(executive) ?? [];
        list.push(r);
        executiveMap.set(executive, list);
      }
      const executives = [...executiveMap.entries()].map(([executive, exRows]) => ({
        executive,
        ...buildMainMetric(exRows, targets),
      })).sort((a, b) => b.totalCount - a.totalCount || a.executive.localeCompare(b.executive));
      return { city, executives, ...buildMainMetric(cityRows, targets) };
    }).sort((a, b) => b.totalCount - a.totalCount || a.city.localeCompare(b.city));
    return { bucket, cities, total: buildMainMetric(rows, targets) };
  });
}
