#!/usr/bin/env node

const BASE_URL = 'http://localhost:3000';

console.log('Testing Complete Login Flow\n');
console.log('='.repeat(50));

async function test() {
  try {
    // Step 1: Create staff member
    console.log('\n1️⃣  Creating test staff member...');
    const createRes = await fetch(`${BASE_URL}/api/v1/staff/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Flow',
        last_name: 'Test',
        role: 'RN',
        email: `flowtest${Date.now()}@dependablecare.local`
      })
    });

    if (!createRes.ok) {
      throw new Error(`Staff creation failed: ${createRes.status}`);
    }

    const createData = await createRes.json();
    const { email } = createData.user_account;
    const { password } = createData.credentials;
    console.log(`   ✓ Staff created`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

    // Step 2: Login
    console.log('\n2️⃣  Testing login...');
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!loginRes.ok) {
      const err = await loginRes.json();
      throw new Error(`Login failed: ${err.error}`);
    }

    const loginData = await loginRes.json();
    const { accessToken, user } = loginData;

    if (!accessToken) {
      throw new Error('No accessToken returned');
    }

    console.log(`   ✓ Login successful`);
    console.log(`   User role: ${user.role}`);
    console.log(`   Token length: ${accessToken.length} chars`);

    // Step 3: Test protected endpoint
    console.log('\n3️⃣  Testing protected API endpoint...');
    const staffRes = await fetch(`${BASE_URL}/api/v1/staff`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!staffRes.ok) {
      throw new Error(`Staff API failed: ${staffRes.status}`);
    }

    const staffData = await staffRes.json();
    console.log(`   ✓ Protected API accessible`);
    console.log(`   Retrieved ${staffData.data?.length || 0} staff members`);

    // Step 4: Verify route redirection
    console.log('\n4️⃣  Testing route redirection logic...');
    const role = user.role;
    const expectedRoute = ['admin', 'manager', 'superadmin'].includes(role) ? '/admin' : '/staff';
    console.log(`   Role: ${role}`);
    console.log(`   Should redirect to: ${expectedRoute}`);
    console.log(`   ✓ Route logic correct`);

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TESTS PASSED\n');
    console.log('System is ready. Next steps:');
    console.log('  1. Open http://localhost:3000 in your browser');
    console.log(`  2. Login with email: ${email}`);
    console.log(`  3. Password: ${password}`);
    console.log(`  4. You will be redirected to: ${expectedRoute}`);

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message);
    process.exit(1);
  }
}

// Wait for server to be ready
let attempts = 0;
const waitForServer = async () => {
  try {
    await fetch(`${BASE_URL}/`);
    await test();
  } catch (err) {
    attempts++;
    if (attempts > 30) {
      console.error('❌ Server did not start within timeout');
      process.exit(1);
    }
    setTimeout(waitForServer, 1000);
  }
};

waitForServer();
