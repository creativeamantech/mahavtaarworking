import * as XLSX from 'xlsx';
import { LoanRecord } from '../types/domain';
import { CityPivotRow, TeamPivotRow, BucketCityPivotRow, ExecCityPivotRow } from './pivots';

export function exportToExcel(data: Record<string, unknown>[], sheetName: string, fileName: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

export function exportCityPivot(cityPivotData: CityPivotRow[]) {
  const rows: Record<string, unknown>[] = cityPivotData.map((c, i) => ({
    '#': i + 1,
    'City': c.city,
    'State': c.state,
    'Collection': c.collection,
    'Sum of %': (c.pct * 100).toFixed(2) + '%',
    'Rollback %': (c.rollbackPct * 100).toFixed(2) + '%',
    'Total Count': c.count,
    'Total POS': c.totalPOS,
    'Total Paid': c.paid,
    'Total Paid POS': c.paidPOS,
    'Sum of Target': c.target,
    'Target Date': c.targetDate || '-',
    'Daily Required POS': c.dailyRequiredPOS || 0,
  }));
  const total = {
    '#': '',
    'City': 'GRAND TOTAL',
    'State': '',
    'Collection': cityPivotData.reduce((s, c) => s + c.collection, 0),
    'Sum of %': '',
    'Rollback %': '',
    'Total Count': cityPivotData.reduce((s, c) => s + c.count, 0),
    'Total POS': cityPivotData.reduce((s, c) => s + c.totalPOS, 0),
    'Total Paid': cityPivotData.reduce((s, c) => s + c.paid, 0),
    'Total Paid POS': cityPivotData.reduce((s, c) => s + c.paidPOS, 0),
    'Sum of Target': cityPivotData.reduce((s, c) => s + c.target, 0),
    'Target Date': '-',
    'Daily Required POS': cityPivotData.reduce((s, c) => s + (c.dailyRequiredPOS || 0), 0),
  };
  rows.push(total);
  exportToExcel(rows, 'City Performance', `City_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportTeamPivot(teamPivotData: TeamPivotRow[]) {
  const rows = teamPivotData.map(e => ({
    'Bucket': e.bkt,
    'Executive': e.exec,
    'Collection': e.collection,
    'Total Count': e.count,
    'Paid Count': e.paid,
    'Total POS': e.totalPOS,
    'Paid POS': e.paidPOS,
    'Total %': (e.pct * 100).toFixed(2) + '%',
  }));
  exportToExcel(rows, 'Team Performance', `Team_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportMatrix(matrixData: { execs: string[]; cities: string[]; matrix: Record<string, Record<string, { totalPOS?: number; paidPOS?: number }>> }, bucket: number) {
  const { execs, cities, matrix } = matrixData;
  const rows = cities.map(city => {
    const row: Record<string, unknown> = { City: city };
    execs.forEach(exec => {
      const cell = matrix[city]?.[exec];
      row[exec] = cell ? (cell.totalPOS ? (( (cell.paidPOS || 0) / cell.totalPOS) * 100).toFixed(2) + '%' : '0%') : '—';
    });
    return row;
  });
  exportToExcel(rows, `Matrix Bucket ${bucket}`, `Matrix_Bucket${bucket}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportRawData(records: LoanRecord[]) {
  const rows = records.map(r => ({
    'Agreement ID': r.agreementid,
    'Bucket': r.bom_bkt,
    'EMI': r.emi_amt,
    'POS': r.principal_outstanding,
    'DAC': r.dac,
    'ECS': r.ecs,
    'Special': r.special,
    'City': r.city,
    'State': r.state,
    'Executive': r.executive_name,
  }));
  exportToExcel(rows, 'Raw Data', `Raw_Data_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportBucketCityPivot(data: BucketCityPivotRow[]) {
  const rows: Record<string, unknown>[] = data.map((c) => ({
    'Bucket': c.bkt,
    'City': c.city,
    'Collection': c.collection,
    'Total Count': c.count,
    'Paid Count': c.paid,
    'POS Paid Only Count': c.posPaidOnlyCount,
    'Total POS': c.totalPOS,
    'Paid POS': c.paidPOS,
    'Needed POS': c.target,
    'Target Date': c.targetDate || '-',
    'Daily Required POS': c.dailyRequiredPOS || 0,
    'POS Paid Only POS': c.posPaidOnlyPOS,
    'Total %': (c.pct * 100).toFixed(2) + '%'
  }));
  exportToExcel(rows, 'City Bucket Matrix', `City_Bucket_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportExecCityPivot(data: ExecCityPivotRow[]) {
  const rows = data.map(e => ({
    'Bucket': e.bkt,
    'City': e.city,
    'Collection': e.collection,
    'Total Count': e.count,
    'Paid Count': e.paid,
    'Total POS': e.totalPOS,
    'Paid POS': e.paidPOS,
    'Total %': (e.pct * 100).toFixed(2) + '%',
  }));
  exportToExcel(rows, 'Team Overall Performance', `Team_Overall_Performance_${new Date().toISOString().slice(0, 10)}.xlsx`);
}