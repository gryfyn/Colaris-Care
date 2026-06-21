import { query } from '@/lib/db.js';
import logger from '@/lib/logger.js';

/**
 * HIPAA Audit Logger — HITECH § 13402, HIPAA § 164.312(b)
 *
 * All PHI access, modification, export, and authentication events
 * are written to audit_log.event_log.
 */
export class AuditLogger {
  async log(opts) {
    const {
      eventType, tableName, recordId, residentId,
      oldValues, newValues, diffKeys,
      phiAccessed = true, justification = null,
      encryptionContext = null,
      req,
    } = opts;

    const actorId   = req?.user?.staffId || req?.user?.id || null;
    const tenantId  = req?.user?.tenantId || null;
    const actorIp   = req?.ip || null;
    const actorRole = req?.user?.role || 'anonymous';
    const sessionId = req?.sessionId || null;
    const requestId = req?.id || null;

    try {
      await query(
        `INSERT INTO audit_log.event_log
           (tenant_id, actor_id, actor_ip, actor_role,
            event_type, table_name, record_id, resident_id,
            old_values, new_values, diff_keys,
            session_id, request_id, phi_accessed, justification)
         VALUES ($1,$2,$3,$4, $5,$6,$7,$8, $9,$10,$11, $12,$13,$14,$15)`,
        [
          tenantId, actorId, actorIp, actorRole,
          eventType, tableName, recordId || null, residentId || null,
          oldValues  ? JSON.stringify(oldValues)  : null,
          newValues  ? JSON.stringify(newValues)  : null,
          diffKeys   ? diffKeys                   : null,
          sessionId, requestId, phiAccessed, justification,
        ]
      );
    } catch (err) {
      logger.error({ err, eventType, tableName }, 'CRITICAL: Audit log write failed');
    }
  }

  async logSelect({ tableName, recordId, residentId, req, justification, encryptionContext }) {
    return this.log({ eventType: 'SELECT', tableName, recordId, residentId, req, justification, encryptionContext });
  }

  async logInsert({ tableName, recordId, residentId, newValues, req, encryptionContext }) {
    return this.log({ eventType: 'INSERT', tableName, recordId, residentId, newValues, req, encryptionContext });
  }

  async logUpdate({ tableName, recordId, residentId, oldValues, newValues, diffKeys, req, encryptionContext }) {
    return this.log({ eventType: 'UPDATE', tableName, recordId, residentId, oldValues, newValues, diffKeys, req, encryptionContext });
  }

  async logDelete({ tableName, recordId, residentId, oldValues, req, encryptionContext }) {
    return this.log({ eventType: 'DELETE', tableName, recordId, residentId, oldValues, req, encryptionContext });
  }

  async logExport({ tableName, residentId, req, justification }) {
    return this.log({ eventType: 'EXPORT', tableName, residentId, req, justification, phiAccessed: true });
  }

  async logLogin({ req, userId, success }) {
    return this.log({
      eventType:   success ? 'LOGIN' : 'FAILED_LOGIN',
      tableName:   'ref.staff',
      recordId:    userId,
      phiAccessed: false,
      req,
    });
  }

  async logLogout({ req }) {
    return this.log({ eventType: 'LOGOUT', tableName: 'ref.staff', phiAccessed: false, req });
  }

  async logBreakGlass({ tableName, recordId, residentId, req, justification }) {
    if (!justification) throw new Error('Break-glass access requires a justification');
    return this.log({
      eventType:   'BREAK_GLASS',
      tableName, recordId, residentId, req, justification,
      phiAccessed: true,
    });
  }
}
