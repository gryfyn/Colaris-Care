#!/usr/bin/env node
/**
 * Admin Workflow Verification Script
 * Tests critical admin workflows to identify issues
 */

const fs = require('fs');
const path = require('path');

class WorkflowTester {
  constructor() {
    this.issues = [];
    this.checks = [];
  }

  check(name, passed, details = '') {
    this.checks.push({ name, passed, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
  }

  checkFileExists(filePath, description) {
    const exists = fs.existsSync(filePath);
    this.check(description, exists, exists ? 'Found' : 'MISSING');
    if (!exists) {
      this.issues.push(`Missing file: ${filePath}`);
    }
    return exists;
  }

  checkFileContains(filePath, searchStr, description) {
    if (!fs.existsSync(filePath)) {
      this.check(description, false, 'File not found');
      this.issues.push(`File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const found = content.includes(searchStr);
    this.check(description, found, found ? 'Found' : 'NOT FOUND');
    if (!found) {
      this.issues.push(`Missing in ${path.basename(filePath)}: ${searchStr}`);
    }
    return found;
  }

  run() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║          ADMIN WORKFLOW VERIFICATION TESTS                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    // Category 1: Core Files Exist
    console.log('📋 Category 1: Core Admin Files');
    this.checkFileExists('src/app/admin/page.js', 'Admin dashboard exists');
    this.checkFileExists('src/app/staff/page.js', 'Staff portal exists');
    this.checkFileExists('src/app/admission/nursing-assessment/page.js', 'Admission form exists');

    // Category 2: API Route Files
    console.log('\n🔌 Category 2: API Routes');
    this.checkFileExists('src/app/api/v1/daily-progress-notes/route.js', 'Progress notes API');
    this.checkFileExists('src/app/api/v1/appointments/route.js', 'Appointments API');
    this.checkFileExists('src/app/api/v1/care-plans-wizard/route.js', 'Care plans API');
    this.checkFileExists('src/app/api/v1/residents/route.js', 'Residents API');

    // Category 3: Key Features Implementation
    console.log('\n⚙️ Category 3: Key Features in Admin');
    this.checkFileContains('src/app/admin/page.js', 'DailyProgressNotesSection', 'Progress Notes section exists');
    this.checkFileContains('src/app/admin/page.js', 'AppointmentsSection', 'Appointments section exists');
    this.checkFileContains('src/app/admin/page.js', 'CarePlansSection', 'Care Plans section exists');
    this.checkFileContains('src/app/admin/page.js', 'ResidentsSection', 'Residents section exists');

    // Category 4: Form Features
    console.log('\n📝 Category 4: Admission Form Features');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'sessionStorage', 'Autosave (sessionStorage)');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'isDirty', 'Dirty-check state');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'loadingDetail', 'Loading state');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'getStepErrors', 'Step validation');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'ResumeDraftDialog', 'Draft restoration');

    // Category 5: Error Handling
    console.log('\n⚠️ Category 5: Error Handling');
    this.checkFileExists('src/app/lib/error-messages.js', 'User-friendly error messages module');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'friendlyErrorMessage', 'Error message mapping in forms');

    // Category 6: API Features
    console.log('\n🔐 Category 6: API Security & Features');
    this.checkFileContains('src/app/api/v1/appointments/route.js', 'duration_minutes', 'Appointment duration tracking');
    this.checkFileContains('src/app/api/v1/appointments/route.js', 'conflict', 'Appointment conflict detection');
    this.checkFileContains('src/app/api/v1/care-plans-wizard/route.js', 'guardResidentAccess', 'Care plan RBAC');
    this.checkFileExists('src/lib/care-plan-transitions.js', 'Care plan status transitions');

    // Category 7: Data Display
    console.log('\n📊 Category 7: Data Display & Persistence');
    this.checkFileContains('src/app/admin/page.js', 'searchTerm', 'Resident search in dashboard');
    this.checkFileContains('src/app/components/MedicationScheduleMatrix.jsx', 'MedicationScheduleMatrix', 'Medication schedule component');
    this.checkFileContains('src/app/admission/nursing-assessment/page.js', 'ResumeDraftDialog', 'Form data restoration');

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                        SUMMARY                                  ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const passed = this.checks.filter(c => c.passed).length;
    const total = this.checks.length;
    const passRate = ((passed / total) * 100).toFixed(0);

    console.log(`✅ Checks Passed: ${passed}/${total} (${passRate}%)`);
    console.log(`❌ Issues Found: ${this.issues.length}\n`);

    if (this.issues.length > 0) {
      console.log('Issues to Fix:');
      this.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
      console.log('');
    }

    return { passed, total, issues: this.issues };
  }
}

const tester = new WorkflowTester();
const result = tester.run();
process.exit(result.issues.length > 0 ? 1 : 0);
