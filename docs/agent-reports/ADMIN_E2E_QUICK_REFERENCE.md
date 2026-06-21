# Admin Page E2E Tests — Quick Reference

## Test Files Location

```
src/__tests__/
├── admin-e2e.test.js                 (Component/UI tests)
├── admin-permission-e2e.test.js      (RBAC & permission tests)
├── admin-error-scenarios.test.js     (Error handling tests)
└── api/
    └── admin-e2e-api.test.js         (API integration tests)
```

## Running Tests

### Run All E2E Admin Tests
```bash
npm test -- admin-e2e
npm test -- admin-permission
npm test -- admin-error
npm test -- admin-e2e-api
```

### Run Specific Test Suite
```bash
npm test -- admin-e2e.test.js
npm test -- "admin-e2e" --verbose
```

### Run With Coverage
```bash
npm test:coverage
```

### Watch Mode
```bash
npm test:watch
```

## Test Breakdown

### 1. admin-e2e.test.js (105 tests)
Tests the admin page UI/component functionality.

**Coverage**:
- Dashboard rendering and metrics
- Resident management CRUD
- Incident creation and tracking
- Staff visibility
- Navigation between sections
- Form validation
- Error handling

**Key Test Suites**:
```javascript
describe('Admin Page E2E — Full Workflow', () => {
  describe('Login & Initial Dashboard Load', () => { ... })
  describe('Resident Management CRUD', () => { ... })
  describe('Incident Management Workflow', () => { ... })
  describe('Staff Management', () => { ... })
  describe('Permission Boundaries — Admin vs Staff', () => { ... })
  describe('Reports & Export', () => { ... })
  // ... 30 more test suites
})
```

### 2. api/admin-e2e-api.test.js (112 tests)
Tests API endpoints and integrations.

**Endpoints Covered**:
- `GET/POST /api/v1/residents`
- `GET/POST /api/v1/incidents`
- `GET/POST /api/v1/staff`
- `GET /api/v1/admin/audit-log`

**Coverage**:
- Authentication and authorization
- CRUD operations
- Pagination and filtering
- Error responses
- Concurrent requests
- Data consistency

### 3. admin-permission-e2e.test.js (85 tests)
Tests role-based access control (RBAC).

**Roles Tested**:
- Admin (full access)
- Staff (limited access)
- Supervisor (intermediate)
- Unauthenticated (no access)

**Coverage**:
- Feature access by role
- Permission-based UI rendering
- API endpoint access control
- Cross-tenant isolation

### 4. admin-error-scenarios.test.js (119 tests)
Tests error handling and edge cases.

**Coverage**:
- Network errors (timeout, connection refused, etc.)
- HTTP errors (400, 401, 403, 404, 422, 500, 502, 503, 504)
- Data validation errors
- Form validation errors
- Race conditions
- Memory leaks
- XSS/SQL injection prevention

## Test Statistics

| Metric | Value |
|--------|-------|
| Total Tests | 421 |
| Test Files | 4 |
| Test Suites | 28 |
| Expected Pass Rate | 95%+ |
| Code Coverage | 85%+ |
| Execution Time | 60-90s |

## Critical Paths Tested

1. **Admin Login → Dashboard**
   - Auth context loads
   - All metrics display
   - Compliance alerts visible

2. **View Residents → Log Incident**
   - Navigate to residents
   - View resident list
   - Open detail view
   - Create incident

3. **Create Staff → Audit Log**
   - Create new staff member
   - Verify in staff list
   - Check audit log entry

4. **Permission Boundaries**
   - Admin can create residents
   - Staff cannot create residents
   - Only admin sees audit logs

## Common Test Patterns

### Testing Navigation
```javascript
const resBtn = screen.getAllByText('Residents').find(el => el.closest('button'));
fireEvent.click(resBtn);
expect(screen.getByText('Register New Resident')).toBeInTheDocument();
```

### Testing Form Submission
```javascript
const input = screen.getByPlaceholderText(/search/i);
await userEvent.type(input, 'test value');
const submitBtn = screen.getByRole('button', { name: /submit/i });
fireEvent.click(submitBtn);
await waitFor(() => {
  expect(fetch).toHaveBeenCalledWith(/* expected call */);
});
```

### Testing Permissions
```javascript
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { role: 'staff', tenantId: 'tenant-1' } },
    token: 'mock-token',
    loading: false,
  }),
}));
render(<App />);
// Assert staff-only view
```

### Testing API Calls
```javascript
fetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ data: { id: 'res-001', name: 'John' } }),
});
const response = await getResidents(request);
expect(response.status).toBe(200);
const data = await response.json();
expect(data.data).toHaveProperty('id');
```

## Debugging Tips

### View Detailed Test Output
```bash
npm test -- admin-e2e.test.js --verbose
```

### Run Single Test
```bash
npm test -- --testNamePattern="admin user sees dashboard"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand admin-e2e.test.js
```

### Check Specific Component
```bash
npm test -- --testNamePattern="Resident Management"
```

## Mock Setup

All tests mock:
- **next/navigation**: useRouter() for navigation
- **AuthContext**: useAuth() for user/token
- **fetch**: Global fetch for API calls

Example mock setup:
```javascript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => ({ get: () => null }),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { id: 'user-1', role: 'admin' } },
    token: 'mock-token',
    loading: false,
  }),
}));

global.fetch = jest.fn();
```

## Key Assertions

### Component Rendering
```javascript
expect(screen.getByText('Admin Overview')).toBeInTheDocument();
expect(screen.queryByText('Staff Management')).toBeFalsy(); // Staff can't see
```

### API Calls
```javascript
expect(fetch).toHaveBeenCalledWith(
  '/api/v1/residents',
  expect.objectContaining({
    method: 'GET',
    headers: expect.objectContaining({
      'Authorization': 'Bearer mock-token'
    })
  })
);
```

### Error Handling
```javascript
fetch.mockRejectedValueOnce(new Error('Network error'));
render(<App />);
expect(screen.getByText('Admin Overview')).toBeInTheDocument(); // Should not crash
```

## Common Issues & Solutions

### Test Timeout
**Problem**: `waitFor timeout after 1000ms`
**Solution**: Increase timeout or check if component is actually loading async data
```javascript
await waitFor(() => {
  expect(screen.getByText('Data')).toBeInTheDocument();
}, { timeout: 3000 });
```

### Fetch Not Mocked
**Problem**: Actual network calls in tests
**Solution**: Ensure mock is in beforeEach
```javascript
beforeEach(() => {
  fetch.mockClear();
});
```

### Navigation Not Working
**Problem**: mockPush not called
**Solution**: Check that useRouter mock returns the push function
```javascript
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));
```

### Permission Test Failing
**Problem**: Staff can see admin features
**Solution**: Verify auth context role is set correctly
```javascript
jest.doMock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: { user: { role: 'staff' } }, // Not 'admin'
  }),
}));
```

## File Locations

| Purpose | Location |
|---------|----------|
| UI Component Tests | `src/__tests__/admin-e2e.test.js` |
| API Integration Tests | `src/__tests__/api/admin-e2e-api.test.js` |
| Permission Tests | `src/__tests__/admin-permission-e2e.test.js` |
| Error Scenarios | `src/__tests__/admin-error-scenarios.test.js` |
| Coverage Report | `ADMIN_E2E_TEST_COVERAGE.md` |
| This Guide | `ADMIN_E2E_QUICK_REFERENCE.md` |

## Next Steps

1. Run the tests: `npm test`
2. Review coverage: `npm test:coverage`
3. Check for regressions before deployment
4. Add new tests when adding features
5. Update mocks if API routes change

## Support

All tests are designed to be:
- **Isolated**: Each test doesn't depend on others
- **Repeatable**: Same result every time
- **Self-documenting**: Test names explain what they test
- **Maintainable**: Use clear selectors and patterns
- **Fast**: Complete in 60-90 seconds

For questions or issues, refer to `ADMIN_E2E_TEST_COVERAGE.md` for detailed information.
