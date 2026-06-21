import { authenticate, authorize, getRequestContext, handleError } from '@/lib/auth-guard.js';
import { withTenantClient } from '@/lib/db.js';
import { generateCredentials } from '@/lib/credential-generator.js';
import { PERMISSIONS } from '@/lib/roles.js';
import { AuditLogger } from '@/lib/audit-logger.js';
import bcrypt from 'bcryptjs';

const audit = new AuditLogger();

export async function POST(request) {
  try {
    const authResult = await authenticate(request);
    if (authResult.error) {
      return Response.json({ error: authResult.error, code: authResult.code }, { status: authResult.status });
    }

    const { user } = authResult;
    if (!authorize(user.role, PERMISSIONS.STAFF_WRITE)) {
      return Response.json({ error: 'Forbidden: you do not have permission to create staff' }, { status: 403 });
    }

    const tenantId = user.tenantId;
    const createdByStaffId = user.staffId;

    const data = await request.json();
    const {
      first_name,
      last_name,
      role,
      preferred_name,
      pronouns,
      email,
      phone,
      shift,
      hire_date,
      employee_id,
      emergency_contact_name,
      emergency_contact_phone,
      emergency_contact_relation,
      certifications,
      notes,
      is_active,
    } = data;

    if (!first_name || !last_name || !role) {
      return new Response(
        JSON.stringify({ error: 'first_name, last_name, and role required' }),
        { status: 400 }
      );
    }

    const credentials = generateCredentials(first_name, last_name, 'staff');

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(credentials.password, 12);

    const result = await withTenantClient(tenantId, createdByStaffId, async (client) => {
      // Generate unique email if not provided
      let staffEmail = email;
      if (!staffEmail) {
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        staffEmail = `${first_name.toLowerCase()}.${last_name.toLowerCase()}.${timestamp}@dependablecare.local`;
      }

      // Create staff record with all available fields
      const { rows: staffRows } = await client.query(
        `INSERT INTO ref.staff (
          tenant_id, first_name, last_name, role, preferred_name, pronouns,
          email, phone, shift, hire_date, employee_id,
          emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          notes, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, first_name, last_name, role, email`,
        [
          tenantId,
          first_name,
          last_name,
          role,
          preferred_name || null,
          pronouns || null,
          staffEmail,
          phone || null,
          shift || null,
          hire_date || null,
          employee_id || null,
          emergency_contact_name || null,
          emergency_contact_phone || null,
          emergency_contact_relation || null,
          notes || null,
          is_active === 'true' || is_active === true,
        ]
      );

      const staffId = staffRows[0].id;

      // Create staff certifications records if provided
      if (certifications && Object.keys(certifications).length > 0) {
        for (const [certName, expiryDate] of Object.entries(certifications)) {
          await client.query(
            `INSERT INTO ref.staff_certifications (
              staff_id, tenant_id, certification_name, certification_type, expiry_date
            ) VALUES ($1, $2, $3, $4, $5)`,
            [staffId, tenantId, certName, 'certification', expiryDate || null]
          );
        }
      }

      // Map job role to system role for permissions
      const roleMapping = {
        'Administrator': 'admin',
        'Director': 'admin',
        'Manager': 'manager',
        'RN': 'staff',
        'LPN': 'staff',
        'QMHP': 'staff',
        'Caregiver': 'staff',
        'Med_Aide': 'staff',
        'Case_Manager': 'staff',
        'Licensee': 'admin',
        'Other': 'staff',
      };
      const systemRole = roleMapping[role] || 'staff';

      // Create user account
      const { rows: userRows } = await client.query(
        `INSERT INTO care.user_accounts (
          tenant_id, staff_id, email, password_hash, role, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, role`,
        [
          tenantId,
          staffId,
          staffEmail,
          passwordHash,
          systemRole,
          true,
        ]
      );

      const userAccountId = userRows[0].id;

      const response = {
        staff: staffRows[0],
        user_account: userRows[0],
        credentials: {
          username: credentials.username,
          password: credentials.password,
          temporary: true,
          mustChangePassword: true,
        },
      };

      // SECURITY: Never log plaintext credentials to stdout
      // Credentials are returned in response only and should be transmitted securely

      return response;
    });

    const req = getRequestContext(request, user);
    await audit.logInsert({
      tableName: 'ref.staff',
      recordId: result.staff.id,
      residentId: null,
      req,
    });
    return Response.json({ data: result }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
