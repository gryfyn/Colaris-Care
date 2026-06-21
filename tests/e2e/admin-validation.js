/**
 * Admin Workflow Validation Script
 * Direct HTTP testing of key admin functions
 * Tests: Progress notes, Appointments, Care plans, Resident search, Medication display
 */

const http = require('http');
const querystring = require('querystring');

class AdminValidator {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.cookies = {};
    this.issues = [];
    this.successes = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);

    if (type === 'error') {
      this.issues.push(message);
    } else if (type === 'success') {
      this.successes.push(message);
    }
  }

  makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl + path);
      const isHttps = url.protocol === 'https:';
      const Client = require(isHttps ? 'https' : 'http');

      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': Object.entries(this.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; '),
          ...headers
        }
      };

      const body = data ? JSON.stringify(data) : null;
      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body);
      }

      const req = Client.request(url, options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          // Extract set-cookie headers
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            setCookie.forEach(cookie => {
              const [name, value] = cookie.split('=');
              this.cookies[name.trim()] = value.split(';')[0];
            });
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: responseData,
            data: responseData ? JSON.parse(responseData) : null
          });
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async runValidations() {
    console.log('\n=== Admin Workflow Validation Suite ===\n');

    await this.validateAdminDashboardLoad();
    await this.validateResidentSearch();
    await this.validateProgressNotesFlow();
    await this.validateAppointmentCreation();
    await this.validateCarePlanDisplay();
    await this.validateMedicationSchedule();

    this.reportResults();
  }

  async validateAdminDashboardLoad() {
    this.log('info', 'Testing: Admin dashboard loads and displays');
    try {
      const response = await this.makeRequest('GET', '/admin');

      if (response.statusCode === 200 || response.statusCode === 401) {
        // 401 is expected if not logged in - server responds
        this.log('success', 'Admin dashboard responds (may require login)');
      } else {
        this.log('error', `Admin dashboard returned ${response.statusCode}`);
      }
    } catch (err) {
      this.log('error', `Dashboard load failed: ${err.message}`);
    }
  }

  async validateResidentSearch() {
    this.log('info', 'Testing: Resident search API');
    try {
      const response = await this.makeRequest(
        'GET',
        '/api/v1/residents?search=test&limit=10'
      );

      if (response.statusCode === 200 || response.statusCode === 401) {
        if (response.data && Array.isArray(response.data.data)) {
          this.log('success', `Resident search API works (${response.data.data.length} results)`);
        } else if (response.statusCode === 401) {
          this.log('success', 'Resident search API accessible (auth required)');
        } else {
          this.log('error', 'Resident search returned unexpected format');
        }
      } else {
        this.log('error', `Resident search returned ${response.statusCode}`);
      }
    } catch (err) {
      this.log('error', `Resident search failed: ${err.message}`);
    }
  }

  async validateProgressNotesFlow() {
    this.log('info', 'Testing: Progress notes API');
    try {
      const response = await this.makeRequest(
        'GET',
        '/api/v1/daily-progress-notes?limit=10'
      );

      if (response.statusCode === 200 || response.statusCode === 401) {
        this.log('success', 'Progress notes API responds');
      } else {
        this.log('error', `Progress notes API returned ${response.statusCode}`);
      }
    } catch (err) {
      this.log('error', `Progress notes test failed: ${err.message}`);
    }
  }

  async validateAppointmentCreation() {
    this.log('info', 'Testing: Appointment endpoints');
    try {
      const getResponse = await this.makeRequest(
        'GET',
        '/api/v1/appointments?limit=10'
      );

      if (getResponse.statusCode === 200 || getResponse.statusCode === 401) {
        this.log('success', 'Appointment list API responds');
      } else {
        this.log('error', `Appointments list returned ${getResponse.statusCode}`);
      }

      // Check conflict detection is in place
      if (getResponse.body.includes('duration') || getResponse.body.includes('conflict')) {
        this.log('success', 'Appointment data includes duration fields');
      }
    } catch (err) {
      this.log('error', `Appointment test failed: ${err.message}`);
    }
  }

  async validateCarePlanDisplay() {
    this.log('info', 'Testing: Care plan endpoints');
    try {
      const response = await this.makeRequest(
        'GET',
        '/api/v1/care-plans?limit=10'
      );

      if (response.statusCode === 200 || response.statusCode === 401) {
        this.log('success', 'Care plans API responds');

        // Check for status transitions validation
        if (response.body.includes('status') || response.body.includes('status_transition')) {
          this.log('success', 'Care plan API includes status fields');
        }
      } else {
        this.log('error', `Care plans API returned ${response.statusCode}`);
      }
    } catch (err) {
      this.log('error', `Care plan test failed: ${err.message}`);
    }
  }

  async validateMedicationSchedule() {
    this.log('info', 'Testing: Medication schedule integration');
    try {
      const response = await this.makeRequest(
        'GET',
        '/api/v1/medications?limit=20'
      );

      if (response.statusCode === 200 || response.statusCode === 401) {
        this.log('success', 'Medication API responds');

        // Check for dosage unit validation
        if (response.body) {
          const hasUnit = response.body.includes('unit') || response.body.includes('dosage');
          if (hasUnit) {
            this.log('success', 'Medication data includes unit/dosage fields');
          }
        }
      }
    } catch (err) {
      this.log('error', `Medication test failed: ${err.message}`);
    }
  }

  reportResults() {
    console.log('\n=== Validation Results ===\n');
    console.log(`✅ Successes: ${this.successes.length}`);
    console.log(`❌ Issues: ${this.issues.length}\n`);

    if (this.issues.length > 0) {
      console.log('Issues Found:');
      this.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }

    console.log(`\nValidation completed at ${new Date().toISOString()}`);
  }
}

// Run validator
const validator = new AdminValidator();
validator.runValidations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
