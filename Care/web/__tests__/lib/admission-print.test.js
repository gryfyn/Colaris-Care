import { buildAdmissionFormHtml } from '@/lib/admission-print.js';

describe('admission-print buildAdmissionFormHtml', () => {
  test('HTML-escapes every dynamic value (XSS prevention)', () => {
    const resident = { name: '<script>alert(1)</script>', room: '"><img src=x onerror=alert(1)>' };
    const admission = {
      status: 'submitted',
      answers: {
        firstName: '<b>inject</b>',
        emergencyName: '<script>evil()</script>',
        conditions: ['<script>cond()</script>'],
        medications: [{ medication: '"><svg onload=alert(1)>', dose: '5mg' }],
        primaryDiagnoses: [{ text: '<script>dx()</script>' }],
      },
    };
    const html = buildAdmissionFormHtml(resident, admission);

    // No raw attacker markup survives.
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>evil()</script>');
    expect(html).not.toContain('<script>cond()</script>');
    expect(html).not.toContain('<script>dx()</script>');
    // No raw injected tags survive (the doc itself never emits img/svg).
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    // Escaped form is present, proving the value was rendered (not dropped).
    expect(html).toContain('&lt;script&gt;');
  });

  test('renders all seven packet sections', () => {
    const html = buildAdmissionFormHtml({ name: 'Jane Doe' }, { answers: {} });
    for (const heading of ['Basic Information', 'Clinical Overview', 'Functional Assessment', 'Behavioral', 'Care Plan', 'Advance Directives', 'Documents']) {
      expect(html).toContain(heading);
    }
  });

  test('tolerates missing admission/answers', () => {
    expect(() => buildAdmissionFormHtml({}, null)).not.toThrow();
    expect(() => buildAdmissionFormHtml(null, undefined)).not.toThrow();
  });
});
