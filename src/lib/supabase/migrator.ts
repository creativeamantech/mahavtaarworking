// @ts-nocheck
import { db, LoanRecord, CustomerFeedback, AttendanceLog, StoredUser, StateTarget } from '@/lib/db';
import { getSupabaseClient } from './client';

export interface MigrationProgress {
  stage: 'IDLE' | 'USERS' | 'LOANS' | 'FEEDBACK' | 'ATTENDANCE' | 'TARGETS' | 'DONE' | 'ERROR';
  currentTable: string;
  totalRecords: number;
  migratedRecords: number;
  percentage: number;
  statusText: string;
  error?: string;
}

export type ProgressCallback = (progress: MigrationProgress) => void;

/**
 * Chunks an array into smaller subsets of specified size.
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Migrates local users from Dexie to Supabase.
 */
export async function migrateUsersToSupabase(onProgress?: ProgressCallback): Promise<number> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  const localUsers = await db.users.toArray();
  if (localUsers.length === 0) return 0;

  const payload = localUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    password_hash: u.passwordHash,
    salt: u.salt,
    iterations: u.iterations || 100000,
    permissions: u.permissions || { views: [] },
    assigned_executive_name: u.assignedExecutiveName || null,
    maintenance_mode: Boolean(u.maintenanceMode),
    last_login: u.lastLogin || null,
  }));

  const { error } = await client.from('users').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Failed to migrate users to Supabase:', error);
    throw new Error(`Failed to migrate users: ${error.message}`);
  }

  return localUsers.length;
}

/**
 * Migrates local loan records from Dexie to Supabase in batches of 500 rows.
 */
export async function migrateLoanRecordsToSupabase(onProgress?: ProgressCallback): Promise<number> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  const totalLoans = await db.loan_records.count();
  if (totalLoans === 0) return 0;

  const BATCH_SIZE = 500;
  let offset = 0;
  let migrated = 0;

  while (offset < totalLoans) {
    const records = await db.loan_records.offset(offset).limit(BATCH_SIZE).toArray();
    if (records.length === 0) break;

    const payload = records.map((r) => {
      const {
        agreementid,
        customer_name,
        city,
        state,
        bom_bkt,
        principal_outstanding,
        amount,
        executive_name,
        contact_number,
        is_conflict,
        ...rest
      } = r as any;

      return {
        agreementid: String(agreementid || '').trim(),
        customer_name: customer_name ? String(customer_name).trim() : null,
        city: city ? String(city).trim() : null,
        state: state ? String(state).trim() : null,
        bom_bkt: bom_bkt ? String(bom_bkt).trim() : null,
        principal_outstanding: Number(principal_outstanding || amount || 0),
        amount: Number(amount || principal_outstanding || 0),
        executive_name: executive_name ? String(executive_name).trim() : null,
        contact_number: contact_number ? String(contact_number).trim() : null,
        is_conflict: Boolean(is_conflict),
        raw_data: rest || {},
        updated_at: new Date().toISOString(),
      };
    }).filter((r) => Boolean(r.agreementid));

    if (payload.length > 0) {
      const { error } = await client.from('loan_records').upsert(payload, { onConflict: 'agreementid' });
      if (error) {
        console.error(`Failed to migrate loan batch at offset ${offset}:`, error);
        throw new Error(`Loan records batch error (${offset}): ${error.message}`);
      }
    }

    migrated += records.length;
    offset += BATCH_SIZE;

    if (onProgress) {
      onProgress({
        stage: 'LOANS',
        currentTable: 'loan_records',
        totalRecords: totalLoans,
        migratedRecords: migrated,
        percentage: Math.min(100, Math.round((migrated / totalLoans) * 100)),
        statusText: `Migrating loan records: ${migrated.toLocaleString()} / ${totalLoans.toLocaleString()}`,
      });
    }
  }

  return migrated;
}

/**
 * Migrates local customer feedback to Supabase.
 */
export async function migrateCustomerFeedbacksToSupabase(onProgress?: ProgressCallback): Promise<number> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  const feedbacks = await db.customer_feedbacks.toArray();
  if (feedbacks.length === 0) return 0;

  const chunks = chunkArray(feedbacks, 250);
  let migrated = 0;

  for (const chunk of chunks) {
    const payload = chunk.map((f) => ({
      id: f.id,
      agreementid: f.agreementid,
      contact_number: f.contactNumber || null,
      availability: f.availability,
      status: f.status,
      standard_feedback: f.standardFeedback || null,
      detailed_feedback: f.detailedFeedback || null,
      amount_paid: Number(f.amountPaid || 0),
      payment_mode: f.paymentMode || null,
      ptp_date: f.ptpDate || null,
      agent_id: f.agentId || null,
      agent_name: f.agentName || null,
      created_at: f.createdAt || new Date().toISOString(),
    }));

    const { error } = await client.from('customer_feedbacks').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn('Failed to migrate feedback chunk, retrying single records:', error);
      // Fallback single upsert if some agreementid foreign keys are missing
      for (const item of payload) {
        await client.from('customer_feedbacks').upsert([item], { onConflict: 'id' }).catch(() => {});
      }
    }

    migrated += chunk.length;
    if (onProgress) {
      onProgress({
        stage: 'FEEDBACK',
        currentTable: 'customer_feedbacks',
        totalRecords: feedbacks.length,
        migratedRecords: migrated,
        percentage: Math.min(100, Math.round((migrated / feedbacks.length) * 100)),
        statusText: `Migrating customer feedbacks: ${migrated} / ${feedbacks.length}`,
      });
    }
  }

  return feedbacks.length;
}

/**
 * Migrates attendance logs to Supabase.
 */
export async function migrateAttendanceLogsToSupabase(onProgress?: ProgressCallback): Promise<number> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  const logs = await db.attendance_logs.toArray();
  if (logs.length === 0) return 0;

  const payload = logs.map((l) => ({
    id: l.id,
    user_id: l.userId,
    user_name: l.userName,
    date: l.date,
    login_time: l.loginTime,
    logout_time: l.logoutTime || null,
    break_duration: Number(l.breakDuration || 0),
    current_break_start: l.currentBreakStart || null,
  }));

  const { error } = await client.from('attendance_logs').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Failed to migrate attendance logs:', error);
    throw new Error(`Attendance logs migration error: ${error.message}`);
  }

  return logs.length;
}

/**
 * Migrates recovery targets to Supabase.
 */
export async function migrateTargetsToSupabase(onProgress?: ProgressCallback): Promise<number> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  const targets = await db.state_targets.toArray();
  if (targets.length === 0) return 0;

  const payload = targets.map((t) => ({
    key: t.key,
    pct: Number(t.pct || 0),
    target_date: t.targetDate || null,
    updated_by: t.updatedBy || null,
    updated_at: t.updatedAt || new Date().toISOString(),
  }));

  const { error } = await client.from('state_targets').upsert(payload, { onConflict: 'key' });
  if (error) {
    console.error('Failed to migrate recovery targets:', error);
    throw new Error(`Targets migration error: ${error.message}`);
  }

  return targets.length;
}

/**
 * Orchestrates complete migration of all tables from IndexedDB to Supabase.
 */
export async function migrateAllToSupabase(onProgress?: ProgressCallback): Promise<{
  usersCount: number;
  loansCount: number;
  feedbacksCount: number;
  attendanceCount: number;
  targetsCount: number;
}> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  // 1. Users
  onProgress?.({
    stage: 'USERS',
    currentTable: 'users',
    totalRecords: 0,
    migratedRecords: 0,
    percentage: 10,
    statusText: 'Migrating users and credentials...',
  });
  const usersCount = await migrateUsersToSupabase(onProgress);

  // 2. Loans
  onProgress?.({
    stage: 'LOANS',
    currentTable: 'loan_records',
    totalRecords: 0,
    migratedRecords: 0,
    percentage: 25,
    statusText: 'Preparing loan records...',
  });
  const loansCount = await migrateLoanRecordsToSupabase(onProgress);

  // 3. Customer Feedbacks
  onProgress?.({
    stage: 'FEEDBACK',
    currentTable: 'customer_feedbacks',
    totalRecords: 0,
    migratedRecords: 0,
    percentage: 75,
    statusText: 'Migrating customer feedbacks and dispositions...',
  });
  const feedbacksCount = await migrateCustomerFeedbacksToSupabase(onProgress);

  // 4. Attendance
  onProgress?.({
    stage: 'ATTENDANCE',
    currentTable: 'attendance_logs',
    totalRecords: 0,
    migratedRecords: 0,
    percentage: 90,
    statusText: 'Migrating attendance logs...',
  });
  const attendanceCount = await migrateAttendanceLogsToSupabase(onProgress);

  // 5. Targets
  onProgress?.({
    stage: 'TARGETS',
    currentTable: 'state_targets',
    totalRecords: 0,
    migratedRecords: 0,
    percentage: 95,
    statusText: 'Migrating recovery targets...',
  });
  const targetsCount = await migrateTargetsToSupabase(onProgress);

  onProgress?.({
    stage: 'DONE',
    currentTable: 'ALL',
    totalRecords: usersCount + loansCount + feedbacksCount + attendanceCount + targetsCount,
    migratedRecords: usersCount + loansCount + feedbacksCount + attendanceCount + targetsCount,
    percentage: 100,
    statusText: 'Migration completed successfully!',
  });

  return {
    usersCount,
    loansCount,
    feedbacksCount,
    attendanceCount,
    targetsCount,
  };
}

/**
 * Pulls latest records from Supabase into local IndexedDB cache.
 */
export async function pullLatestFromSupabaseToLocal(onProgress?: (msg: string) => void): Promise<{
  loanCount: number;
  userCount: number;
}> {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client is not configured.');

  onProgress?.('Fetching users from Supabase...');
  const { data: remoteUsers, error: userErr } = await client.from('users').select('*');
  if (!userErr && Array.isArray(remoteUsers) && remoteUsers.length > 0) {
    const localUsers = remoteUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash: u.password_hash,
      salt: u.salt,
      iterations: u.iterations,
      permissions: u.permissions || { views: [] },
      assignedExecutiveName: u.assigned_executive_name,
      maintenanceMode: u.maintenance_mode,
      lastLogin: u.last_login,
    }));
    await db.users.bulkPut(localUsers as any);
  }

  onProgress?.('Fetching loan records from Supabase...');
  const { data: remoteLoans, error: loanErr } = await client
    .from('loan_records')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(10000);

  let loanCount = 0;
  if (!loanErr && Array.isArray(remoteLoans) && remoteLoans.length > 0) {
    const localLoans = remoteLoans.map((r) => ({
      agreementid: r.agreementid,
      customer_name: r.customer_name,
      city: r.city,
      state: r.state,
      bom_bkt: r.bom_bkt,
      principal_outstanding: Number(r.principal_outstanding || 0),
      amount: Number(r.amount || 0),
      executive_name: r.executive_name,
      contact_number: r.contact_number,
      is_conflict: r.is_conflict,
      ...(r.raw_data || {}),
    }));

    await db.loan_records.bulkPut(localLoans as any);
    loanCount = localLoans.length;
  }

  return {
    userCount: remoteUsers?.length || 0,
    loanCount,
  };
}
