import { NAV_GROUPS, NAV_ITEMS_FLAT } from '../app/components/nav/nav-config';

describe('nav-config', () => {
  describe('NAV_GROUPS', () => {
    it('exports an array', () => {
      expect(Array.isArray(NAV_GROUPS)).toBe(true);
    });

    it('has exactly 3 groups', () => {
      expect(NAV_GROUPS).toHaveLength(3);
    });

    it('groups are named Core, Clinical, Facility', () => {
      expect(NAV_GROUPS.map(g => g.label)).toEqual(['Core', 'Clinical', 'Facility']);
    });

    it('each group has a label string and items array', () => {
      NAV_GROUPS.forEach(g => {
        expect(typeof g.label).toBe('string');
        expect(Array.isArray(g.items)).toBe(true);
      });
    });

    it('Core group has 5 items', () => {
      const core = NAV_GROUPS.find(g => g.label === 'Core');
      expect(core.items).toHaveLength(5);
    });

    it('Clinical group has 3 items', () => {
      const clinical = NAV_GROUPS.find(g => g.label === 'Clinical');
      expect(clinical.items).toHaveLength(3);
    });

    it('Facility group has 3 items', () => {
      const facility = NAV_GROUPS.find(g => g.label === 'Facility');
      expect(facility.items).toHaveLength(3);
    });

    it('every item has id, label, icon fields', () => {
      NAV_GROUPS.flatMap(g => g.items).forEach(item => {
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
        expect(typeof item.label).toBe('string');
        expect(item.label.length).toBeGreaterThan(0);
        expect(typeof item.icon).toBe('string');
        expect(item.icon.length).toBeGreaterThan(0);
      });
    });

    it('all item ids are unique across all groups', () => {
      const ids = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });

    it('Core group contains dashboard, residents, care, medications, staff', () => {
      const core = NAV_GROUPS.find(g => g.label === 'Core');
      const ids = core.items.map(i => i.id);
      expect(ids).toContain('dashboard');
      expect(ids).toContain('residents');
      expect(ids).toContain('care');
      expect(ids).toContain('medications');
      expect(ids).toContain('staff');
    });

    it('Clinical group contains reports, compliance, face-sheet', () => {
      const clinical = NAV_GROUPS.find(g => g.label === 'Clinical');
      const ids = clinical.items.map(i => i.id);
      expect(ids).toContain('reports');
      expect(ids).toContain('compliance');
      expect(ids).toContain('face-sheet');
    });

    it('Facility group contains appointments, announcements, calendar', () => {
      const facility = NAV_GROUPS.find(g => g.label === 'Facility');
      const ids = facility.items.map(i => i.id);
      expect(ids).toContain('appointments');
      expect(ids).toContain('announcements');
      expect(ids).toContain('calendar');
    });
  });

  describe('NAV_ITEMS_FLAT', () => {
    it('exports an array', () => {
      expect(Array.isArray(NAV_ITEMS_FLAT)).toBe(true);
    });

    it('has 11 items total (5 + 3 + 3)', () => {
      expect(NAV_ITEMS_FLAT).toHaveLength(11);
    });

    it('preserves group order — Core items come first', () => {
      const firstId = NAV_ITEMS_FLAT[0].id;
      expect(firstId).toBe('dashboard');
    });

    it('last item is calendar (last Facility item)', () => {
      const lastId = NAV_ITEMS_FLAT[NAV_ITEMS_FLAT.length - 1].id;
      expect(lastId).toBe('calendar');
    });

    it('contains all ids from NAV_GROUPS', () => {
      const groupIds = NAV_GROUPS.flatMap(g => g.items.map(i => i.id));
      const flatIds  = NAV_ITEMS_FLAT.map(i => i.id);
      groupIds.forEach(id => expect(flatIds).toContain(id));
    });

    it('is a true flat array — no nested arrays', () => {
      NAV_ITEMS_FLAT.forEach(item => {
        expect(Array.isArray(item)).toBe(false);
        expect(typeof item).toBe('object');
      });
    });
  });
});
