import { buildCarePlanHtml } from '@/lib/care-plan-print.js';

describe('care-plan-print buildCarePlanHtml', () => {
  test('HTML-escapes every dynamic value (XSS prevention)', () => {
    const plan = {
      residentName: '<script>alert(1)</script>',
      title: '"><img src=x onerror=alert(1)>',
      room: 'A1',
      status: 'active',
      content: {
        owner: '<b>owner</b>',
        reviewCycle: 'Quarterly',
        goals: [{ title: '<script>goal()</script>', progress: 'On track' }],
        objectives: [{ title: '<script>obj()</script>', goal: 'g', cadence: 'd' }],
        interventions: [{ title: '<script>iv()</script>', owner: 'o', frequency: 'f' }],
        reviews: [{ title: '<script>rev()</script>', meta: 'm', note: 'n' }],
      },
    };
    const html = buildCarePlanHtml(plan);

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>goal()</script>');
    expect(html).not.toContain('<script>obj()</script>');
    expect(html).not.toContain('<script>iv()</script>');
    expect(html).not.toContain('<script>rev()</script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  test('renders the core sections and tolerates empty content', () => {
    const html = buildCarePlanHtml({ residentName: 'Jane', title: 'Plan', content: {} });
    for (const heading of ['Plan overview', 'Goals', 'Objectives', 'Interventions', 'Review history']) {
      expect(html).toContain(heading);
    }
    expect(() => buildCarePlanHtml(null)).not.toThrow();
  });
});
