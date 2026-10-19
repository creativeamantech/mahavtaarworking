// @ts-nocheck
/**
 * Multi-Spreadsheet Architecture Engine for Mahavtaar Ledger
 * Separates data across dedicated Google Spreadsheets to prevent Google's 10 MB per-file quota block,
 * provides Google Drive linking, template creation, 10 MB capacity monitoring, and auto-sync.
 */
import * as XLSX from 'xlsx';
import { extractSheetInfo, fetchGoogleSheetCsv, GoogleSheetInfo } from './googleSheets';
import { db } from './db';
import { atomicFileImport } from './repositories/loanRepository';
import { parseMainFile, mergeMainIntoRecords } from './fileParser';

export const MAX_SHEET_BYTES = 10 * 1024 * 1024; // 10 MB limit enforced by Google Sheets
export const WARNING_SHEET_BYTES = 7 * 1024 * 1024; // 7 MB (70%)
export const CRITICAL_SHEET_BYTES = 9 * 1024 * 1024; // 9 MB (90%)

export type ModuleId =
  | 'users'
  | 'master_allocations'
  | 'feedbacks'
  | 'attendance'
  | 'targets_and_config';

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  nameHindi: string;
  category: string;
  description: string;
  driveTemplateTitle: string;
  iconName: string;
  requiredHeaders: string[];
  optionalHeaders: string[];
  sampleData: Record<string, string>[];
}

export interface LinkedModuleSheet {
  moduleId: ModuleId;
  sheetId: string;
  gid: string;
  url: string;
  name: string;
  driveViewUrl: string;
  connectedAt: string;
  lastSyncedAt?: string;
  lastSyncStatus: 'IDLE' | 'SUCCESS' | 'ERROR' | 'SYNCING';
  lastSyncError?: string;
  recordCount: number;
  estimatedSizeBytes: number;
  foundHeaders: string[];
  missingHeaders: string[];
}

export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  users: {
    id: 'users',
    name: 'Users & Team Management',
    nameHindi: 'उपयोगकर्ता एवं टीम प्रबंधन',
    category: 'Authentication & Access',
    description: 'Stores user accounts, roles, access permissions, and FOS agent mappings.',
    driveTemplateTitle: 'Mahavtaar - 01 Users & Team Management',
    iconName: 'Users',
    requiredHeaders: ['id', 'name', 'email', 'role'],
    optionalHeaders: ['assignedExecutiveName', 'maintenanceMode', 'status', 'createdAt'],
    sampleData: [
      {
        id: 'usr_001',
        name: 'Amit Sharma',
        email: 'amit.sharma@mahavtaar.com',
        role: 'ADMIN',
        assignedExecutiveName: 'Amit Sharma',
        maintenanceMode: 'false',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr_002',
        name: 'Rahul Verma',
        email: 'rahul.v@mahavtaar.com',
        role: 'EXECUTIVE',
        assignedExecutiveName: 'Rahul Verma',
        maintenanceMode: 'false',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
    ],
  },
  master_allocations: {
    id: 'master_allocations',
    name: 'Master Allocation (Loan Cases)',
    nameHindi: 'मास्टर एलोकेशन (केस डेटा)',
    category: 'Core Portfolio',
    description: 'Primary loan agreements, borrower demographics, POS amounts, bucket classification, and field staff allocations.',
    driveTemplateTitle: 'Mahavtaar - 02 Master Allocation Cases',
    iconName: 'Database',
    requiredHeaders: ['agreementid', 'customer_name', 'city', 'state', 'bom_bkt', 'pos'],
    optionalHeaders: ['allocated_fos', 'allocation_status', 'contactNumber', 'product', 'loan_amount'],
    sampleData: [
      {
        agreementid: 'AGR-908123',
        customer_name: 'Rajesh Kumar',
        city: 'Mumbai',
        state: 'Maharashtra',
        bom_bkt: 'BKT 2',
        pos: '45000',
        allocated_fos: 'Rahul Verma',
        allocation_status: 'ASSIGNED',
        contactNumber: '9876543210',
        product: 'Two Wheeler Loan',
      },
      {
        agreementid: 'AGR-908124',
        customer_name: 'Pooja Singh',
        city: 'Pune',
        state: 'Maharashtra',
        bom_bkt: 'BKT 1',
        pos: '28000',
        allocated_fos: 'Sunil Patil',
        allocation_status: 'PENDING',
        contactNumber: '9876543211',
        product: 'Personal Loan',
      },
    ],
  },
  feedbacks: {
    id: 'feedbacks',
    name: 'Customer Feedbacks & Call Logs',
    nameHindi: 'कस्टमर फीडबैक व कॉलिंग लॉग',
    category: 'Field Operations',
    description: 'Call outcomes, borrower disposition, PTP dates, collected amounts, and agent follow-up remarks.',
    driveTemplateTitle: 'Mahavtaar - 03 Customer Feedbacks & Call Logs',
    iconName: 'MessageSquare',
    requiredHeaders: ['id', 'agreementid', 'agentName', 'status', 'createdAt'],
    optionalHeaders: ['agentId', 'contactNumber', 'availability', 'standardFeedback', 'detailedFeedback', 'amountPaid', 'ptpDate', 'paymentMode'],
    sampleData: [
      {
        id: 'fb_101',
        agreementid: 'AGR-908123',
        agentName: 'Rahul Verma',
        status: 'PTP',
        createdAt: new Date().toISOString(),
        agentId: 'usr_002',
        contactNumber: '9876543210',
        availability: 'CONNECTED',
        standardFeedback: 'Customer promised to pay on 20th',
        detailedFeedback: 'Visited customer address, customer agreed to clear overdue by online link',
        amountPaid: '15000',
        ptpDate: '2026-10-20',
        paymentMode: 'UPI',
      },
    ],
  },
  attendance: {
    id: 'attendance',
    name: 'Attendance & Activity Logs',
    nameHindi: 'उपस्थिति एवं फील्ड कार्य लॉग',
    category: 'Workforce Tracking',
    description: 'Field agent shift attendance, login/logout timings, break durations, and location verification.',
    driveTemplateTitle: 'Mahavtaar - 04 Attendance & Activity Logs',
    iconName: 'CalendarClock',
    requiredHeaders: ['id', 'userId', 'userName', 'date', 'loginTime'],
    optionalHeaders: ['logoutTime', 'breakDuration', 'status', 'notes'],
    sampleData: [
      {
        id: 'att_201',
        userId: 'usr_002',
        userName: 'Rahul Verma',
        date: '2026-10-15',
        loginTime: '09:15:00 AM',
        logoutTime: '06:30:00 PM',
        breakDuration: '45',
        status: 'PRESENT',
        notes: 'Field visits completed in Pune sector',
      },
    ],
  },
  targets_and_config: {
    id: 'targets_and_config',
    name: 'Targets & System Parameters',
    nameHindi: 'लक्ष्य एवं सिस्टम पैरामीटर',
    category: 'Performance Benchmarks',
    description: 'City/State collection targets, resolution thresholds, and global application configuration parameters.',
    driveTemplateTitle: 'Mahavtaar - 05 Targets & Configurations',
    iconName: 'Target',
    requiredHeaders: ['key', 'pct'],
    optionalHeaders: ['title', 'targetAmount', 'state', 'city', 'updatedBy', 'updatedAt', 'notes'],
    sampleData: [
      {
        key: 'TARGET_MAHARASHTRA_BKT1',
        pct: '85',
        title: 'Maharashtra Bucket 1 Target',
        targetAmount: '5000000',
        state: 'Maharashtra',
        city: 'All',
        updatedBy: 'Admin',
        updatedAt: new Date().toISOString(),
        notes: 'Monthly collection milestone',
      },
      {
        key: 'TARGET_GUJARAT_BKT1',
        pct: '80',
        title: 'Gujarat Bucket 1 Target',
        targetAmount: '3500000',
        state: 'Gujarat',
        city: 'All',
        updatedBy: 'Admin',
        updatedAt: new Date().toISOString(),
        notes: 'Monthly collection milestone',
      },
    ],
  },
};

const STORAGE_KEY = 'mahavtaar_module_spreadsheets';

/**
 * Retrieves all currently linked module spreadsheets
 */
export function getLinkedModuleSheets(): Record<ModuleId, LinkedModuleSheet | null> {
  const result: Record<ModuleId, LinkedModuleSheet | null> = {
    users: null,
    master_allocations: null,
    feedbacks: null,
    attendance: null,
    targets_and_config: null,
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const id of Object.keys(MODULE_DEFINITIONS) as ModuleId[]) {
        if (parsed[id]) {
          result[id] = parsed[id];
        }
      }
    }
  } catch (err) {
    console.error('Failed to load linked module spreadsheets from localStorage', err);
  }

  return result;
}

/**
 * Saves a linked module spreadsheet configuration
 */
export function saveLinkedModuleSheet(sheet: LinkedModuleSheet): void {
  const current = getLinkedModuleSheets();
  current[sheet.moduleId] = sheet;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent('mahavtaar_spreadsheets_changed', {
        detail: { moduleId: sheet.moduleId, action: 'SAVE' },
      })
    );
  } catch (err) {
    console.error('Failed to save linked module spreadsheet', err);
  }
}

/**
 * Removes a linked spreadsheet from a specific module
 */
export function unlinkModuleSheet(moduleId: ModuleId): void {
  const current = getLinkedModuleSheets();
  delete current[moduleId];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(
      new CustomEvent('mahavtaar_spreadsheets_changed', {
        detail: { moduleId, action: 'UNLINK' },
      })
    );
  } catch (err) {
    console.error('Failed to unlink module spreadsheet', err);
  }
}

/**
 * Format bytes to readable string (e.g. 1.25 MB, 45 KB)
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0 || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Evaluates capacity usage against Google Sheets 10 MB hard quota
 */
export function getCapacityMetrics(estimatedBytes: number) {
  const percent = Math.min(100, Math.max(0, (estimatedBytes / MAX_SHEET_BYTES) * 100));
  let status: 'SAFE' | 'WARNING' | 'CRITICAL' = 'SAFE';

  if (estimatedBytes >= CRITICAL_SHEET_BYTES) {
    status = 'CRITICAL';
  } else if (estimatedBytes >= WARNING_SHEET_BYTES) {
    status = 'WARNING';
  }

  return {
    percent: Number(percent.toFixed(1)),
    status,
    usedFormatted: formatBytes(estimatedBytes),
    limitFormatted: '10.0 MB',
    remainingFormatted: formatBytes(Math.max(0, MAX_SHEET_BYTES - estimatedBytes)),
  };
}

/**
 * Validates a Google Sheet URL or ID specifically for a module's expected schema
 */
export async function validateModuleSheet(
  moduleId: ModuleId,
  urlOrId: string
): Promise<{
  isValid: boolean;
  sheetInfo: GoogleSheetInfo;
  driveViewUrl: string;
  rowCount: number;
  estimatedBytes: number;
  foundHeaders: string[];
  missingRequiredHeaders: string[];
  sampleRows: Record<string, unknown>[];
  csvText: string;
}> {
  const info = extractSheetInfo(urlOrId);
  if (!info) {
    throw new Error('Invalid Google Sheet URL or ID. Please paste a valid docs.google.com/spreadsheets/d/... link.');
  }

  const { csvText, buffer } = await fetchGoogleSheetCsv(info);
  const estimatedBytes = buffer.byteLength;

  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The Google Sheet tab appears to be empty.');
  }

  const sheetData = wb.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetData, { defval: '' });

  const rawColumns = Object.keys(rows[0] || {});
  const normalizedColumns = rawColumns.map((c) => c.trim().toLowerCase());

  const def = MODULE_DEFINITIONS[moduleId];
  const missingHeaders: string[] = [];

  for (const req of def.requiredHeaders) {
    const reqNorm = req.trim().toLowerCase();
    const hasMatch = normalizedColumns.some((col) => {
      return col === reqNorm || col.replace(/[\s_-]+/g, '') === reqNorm.replace(/[\s_-]+/g, '');
    });
    if (!hasMatch) {
      missingHeaders.push(req);
    }
  }

  const driveViewUrl = `https://docs.google.com/spreadsheets/d/${info.sheetId}/edit#gid=${info.gid}`;

  return {
    isValid: missingHeaders.length === 0,
    sheetInfo: info,
    driveViewUrl,
    rowCount: rows.length,
    estimatedBytes,
    foundHeaders: rawColumns,
    missingRequiredHeaders: missingHeaders,
    sampleRows: rows.slice(0, 5),
    csvText,
  };
}

/**
 * Generates ready-to-copy or ready-to-download CSV template content for a module
 */
export function generateModuleTemplateCsv(moduleId: ModuleId): string {
  const def = MODULE_DEFINITIONS[moduleId];
  const allHeaders = [...def.requiredHeaders, ...def.optionalHeaders];

  const headerRow = allHeaders.join(',');
  const sampleRows = def.sampleData.map((row) => {
    return allHeaders.map((h) => (row[h] !== undefined ? `"${String(row[h]).replace(/"/g, '""')}"` : '""')).join(',');
  });

  return [headerRow, ...sampleRows].join('\r\n');
}

/**
 * Triggers a browser download of a starter blank CSV template with correct headers
 */
export function downloadModuleTemplateCsv(moduleId: ModuleId): void {
  const csv = generateModuleTemplateCsv(moduleId);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Mahavtaar_${moduleId}_template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Synchronizes a single module from its linked Google Sheet into the application state / Dexie
 */
export async function syncModuleSheet(
  moduleId: ModuleId,
  userName = 'Spreadsheet Sync'
): Promise<{
  moduleId: ModuleId;
  rowCount: number;
  newRows: number;
  updatedRows: number;
  estimatedBytes: number;
  error?: string;
}> {
  const current = getLinkedModuleSheets();
  const linked = current[moduleId];

  if (!linked) {
    throw new Error(`Module ${moduleId} has no linked Google Spreadsheet.`);
  }

  // Update status to SYNCING
  saveLinkedModuleSheet({
    ...linked,
    lastSyncStatus: 'SYNCING',
  });

  try {
    const preview = await validateModuleSheet(moduleId, linked.url);

    let newCount = 0;
    let updatedCount = 0;

    if (moduleId === 'master_allocations') {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(preview.csvText).buffer;
      const parsed = parseMainFile(buffer);
      const allDbRecords = await db.loan_records.toArray();
      const merged = mergeMainIntoRecords(allDbRecords, parsed);

      const entry = {
        id: crypto.randomUUID(),
        type: 'MAIN_DATA' as const,
        fileName: linked.name || 'Master Allocation Sheet',
        recordCount: parsed.length,
        uploadedBy: userName,
        createdAt: new Date().toISOString(),
      };

      await atomicFileImport(merged.mergedRows, entry);
      newCount = merged.newCount;
      updatedCount = merged.updatedCount;
    } else if (moduleId === 'users') {
      const wb = XLSX.read(new TextEncoder().encode(preview.csvText), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      for (const row of rows) {
        const id = String(row.id || crypto.randomUUID()).trim();
        const email = String(row.email || '').trim().toLowerCase();
        const name = String(row.name || '').trim();
        const role = String(row.role || 'VIEWER').toUpperCase();
        const assignedExecutiveName = String(row.assignedExecutiveName || '').trim() || undefined;

        if (email && name) {
          const existing = await db.users.where('email').equalsIgnoreCase(email).first();
          if (existing) {
            await db.users.update(existing.id, {
              name,
              role,
              assignedExecutiveName,
            });
            updatedCount++;
          } else {
            await db.users.add({
              id,
              name,
              email,
              role,
              passwordHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // default empty hash
              permissions: { views: [] },
              assignedExecutiveName,
            });
            newCount++;
          }
        }
      }
    } else if (moduleId === 'feedbacks') {
      const wb = XLSX.read(new TextEncoder().encode(preview.csvText), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      for (const row of rows) {
        const agreementid = String(row.agreementid || row.AGREEMENTID || '').trim();
        if (!agreementid) continue;

        const id = String(row.id || crypto.randomUUID()).trim();
        const existing = await db.customer_feedbacks.get(id);

        const feedbackData = {
          id,
          agreementid,
          agentId: String(row.agentId || 'sheet_sync'),
          agentName: String(row.agentName || 'Google Sheets Agent'),
          contactNumber: String(row.contactNumber || ''),
          availability: String(row.availability || 'CONNECTED'),
          status: String(row.status || 'PTP'),
          standardFeedback: String(row.standardFeedback || ''),
          detailedFeedback: String(row.detailedFeedback || ''),
          amountPaid: Number(row.amountPaid || 0),
          ptpDate: String(row.ptpDate || ''),
          paymentMode: String(row.paymentMode || ''),
          createdAt: String(row.createdAt || new Date().toISOString()),
        };

        if (existing) {
          await db.customer_feedbacks.put(feedbackData);
          updatedCount++;
        } else {
          await db.customer_feedbacks.add(feedbackData);
          newCount++;
        }
      }
    } else if (moduleId === 'attendance') {
      const wb = XLSX.read(new TextEncoder().encode(preview.csvText), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      for (const row of rows) {
        const id = String(row.id || crypto.randomUUID()).trim();
        const date = String(row.date || new Date().toISOString().split('T')[0]);
        const userName = String(row.userName || '').trim();

        if (userName) {
          const attendanceData = {
            id,
            userId: String(row.userId || id),
            userName,
            date,
            loginTime: String(row.loginTime || '09:00:00 AM'),
            logoutTime: String(row.logoutTime || ''),
            breakDuration: Number(row.breakDuration || 0),
          };
          await db.attendance_logs.put(attendanceData);
          newCount++;
        }
      }
    } else if (moduleId === 'targets_and_config') {
      const wb = XLSX.read(new TextEncoder().encode(preview.csvText), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

      for (const row of rows) {
        const key = String(row.key || '').trim();
        const pct = Number(row.pct || row.targetPercentage || 0);
        if (key) {
          await db.state_targets.put({
            key,
            pct,
            updatedBy: String(row.updatedBy || userName),
            updatedAt: new Date().toISOString(),
          });
          newCount++;
        }
      }
    }

    // Save updated success state
    saveLinkedModuleSheet({
      ...linked,
      lastSyncedAt: new Date().toISOString(),
      lastSyncStatus: 'SUCCESS',
      lastSyncError: undefined,
      recordCount: preview.rowCount,
      estimatedSizeBytes: preview.estimatedBytes,
      foundHeaders: preview.foundHeaders,
      missingHeaders: preview.missingRequiredHeaders,
    });

    return {
      moduleId,
      rowCount: preview.rowCount,
      newRows: newCount,
      updatedRows: updatedCount,
      estimatedBytes: preview.estimatedBytes,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    saveLinkedModuleSheet({
      ...linked,
      lastSyncStatus: 'ERROR',
      lastSyncError: errorMsg,
    });
    return {
      moduleId,
      rowCount: linked.recordCount || 0,
      newRows: 0,
      updatedRows: 0,
      estimatedBytes: linked.estimatedSizeBytes || 0,
      error: errorMsg,
    };
  }
}

/**
 * Synchronizes all linked sheets concurrently across all 5+ modules
 */
export async function syncAllLinkedModuleSheets(userName = 'Global Multi-Sheet Auto-Sync'): Promise<{
  totalModules: number;
  successfulModules: number;
  totalRows: number;
  newRows: number;
  updatedRows: number;
  totalBytes: number;
  errors: string[];
}> {
  const linkedSheets = getLinkedModuleSheets();
  const activeModules = (Object.keys(linkedSheets) as ModuleId[]).filter((id) => linkedSheets[id] !== null);

  if (activeModules.length === 0) {
    return {
      totalModules: 0,
      successfulModules: 0,
      totalRows: 0,
      newRows: 0,
      updatedRows: 0,
      totalBytes: 0,
      errors: [],
    };
  }

  let totalRows = 0;
  let newRows = 0;
  let updatedRows = 0;
  let totalBytes = 0;
  let successfulModules = 0;
  const errors: string[] = [];

  // Run all active sheet syncs
  const results = await Promise.allSettled(
    activeModules.map((moduleId) => syncModuleSheet(moduleId, userName))
  );

  results.forEach((res, index) => {
    const moduleId = activeModules[index];
    const def = MODULE_DEFINITIONS[moduleId];

    if (res.status === 'fulfilled') {
      const data = res.value;
      if (data.error) {
        errors.push(`${def.name}: ${data.error}`);
      } else {
        successfulModules++;
        totalRows += data.rowCount;
        newRows += data.newRows;
        updatedRows += data.updatedRows;
        totalBytes += data.estimatedBytes;
      }
    } else {
      errors.push(`${def.name}: ${res.reason?.message || String(res.reason)}`);
    }
  });

  // Broadcast overall data sync event so React reloads records in memory
  window.dispatchEvent(
    new CustomEvent('mahavtaar_data_synced', {
      detail: { totalRows, newRows, updatedRows, errors, totalBytes },
    })
  );

  return {
    totalModules: activeModules.length,
    successfulModules,
    totalRows,
    newRows,
    updatedRows,
    totalBytes,
    errors,
  };
}
