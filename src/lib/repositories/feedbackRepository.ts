// @ts-nocheck
/**
 * Mahavtaar Ledger - Customer Feedback Repository
 * Data access and mutation layer for CustomerFeedback entities with audit and sync journaling.
 */

import { db, CustomerFeedback } from '../db';
import { incrementLamportClock } from '../sync/journal';
import { getLocalDeviceIdentity } from '../sync/deviceIdentity';
import { ValidationError } from '../errors';
import { isSupabaseConfigured, getSupabaseClient } from '../supabase/client';

export interface FeedbackMutationContext {
  actorUserId?: string;
  actorName: string;
  actorRole: string;
}

export async function getFeedbackByAgreementId(agreementid: string): Promise<CustomerFeedback[]> {
  return await db.customer_feedbacks.where('agreementid').equals(agreementid).reverse().sortBy('createdAt');
}

export async function getAllFeedbacks(): Promise<CustomerFeedback[]> {
  return await db.customer_feedbacks.reverse().sortBy('createdAt');
}

export async function submitCustomerFeedback(
  feedbackData: Omit<CustomerFeedback, 'id' | 'createdAt'> & { id?: string },
  ctx: FeedbackMutationContext
): Promise<CustomerFeedback> {
  if (!feedbackData.agreementid) {
    throw new ValidationError('Agreement ID is required for customer feedback.');
  }

  const feedbackId = feedbackData.id || `FB-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const record: CustomerFeedback = {
    ...feedbackData,
    id: feedbackId,
    createdAt: timestamp,
  };

  await db.transaction('rw', [db.customer_feedbacks, db.audit_log, db.sync_journal], async () => {
    await db.customer_feedbacks.put(record);

    await db.audit_log.add({
      id: crypto.randomUUID(),
      agreementid: feedbackData.agreementid,
      field: 'FEEDBACK_SUBMITTED',
      oldValue: '',
      newValue: JSON.stringify({
        status: record.status,
        disposition: (record as any).disposition,
        ptpDate: record.ptpDate,
        amountPaid: record.amountPaid,
      }),
      changedBy: ctx.actorName,
      createdAt: timestamp,
      source: 'CUSTOMER_FEEDBACK',
    });

    const lamport = incrementLamportClock();
    const device = getLocalDeviceIdentity();

    await db.sync_journal.add({
      id: crypto.randomUUID(),
      timestamp,
      lamport,
      tableName: 'customer_feedbacks',
      recordId: feedbackId,
      action: 'INSERT',
      data: record,
      peerId: device.peerId,
      deviceId: device.deviceId,
      status: 'QUEUED',
      hash: crypto.randomUUID(),
    });
  });

  // Push to Supabase if configured
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) {
      client.from('customer_feedbacks').upsert({
        id: record.id,
        agreementid: record.agreementid,
        contact_number: record.contactNumber || null,
        availability: record.availability,
        status: record.status,
        standard_feedback: record.standardFeedback || null,
        detailed_feedback: record.detailedFeedback || null,
        amount_paid: Number(record.amountPaid || 0),
        payment_mode: record.paymentMode || null,
        ptp_date: record.ptpDate || null,
        agent_id: record.agentId || null,
        agent_name: record.agentName || null,
        created_at: record.createdAt,
      }, { onConflict: 'id' }).catch((e) => console.warn('Supabase feedback sync failed:', e));
    }
  }

  return record;
}
