import { render, screen } from '@testing-library/react';
import { Avatar, Badge, EmptyState, PageHeader, Panel, StatCard, avatarColors, initials } from '@/components/ui/data';

describe('display primitives', () => {
  test.each([
    ['Ada Lovelace', 'AL'],
    [' prince ', 'P'],
    ['', '—'],
  ])('initials(%p) returns %p', (name, expected) => expect(initials(name)).toBe(expected));

  test('avatar colors are deterministic and vary across names', () => {
    expect(avatarColors('Ada')).toEqual(avatarColors('Ada'));
    expect(avatarColors('Ada')).toHaveLength(3);
    expect(avatarColors('Ada')).not.toEqual(avatarColors('Grace'));
  });

  test('Avatar renders initials or an accessible portrait', () => {
    const { rerender } = render(<Avatar name="Ada Lovelace" round sm />);
    expect(screen.getByText('AL')).toHaveClass('is-round', 'sm');
    rerender(<Avatar name="Ada Lovelace" src="/ada.jpg" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace portrait' })).toHaveAttribute('src', '/ada.jpg');
  });

  test('Badge renders semantic tone and optional dot', () => {
    const { container } = render(<Badge tone="green" dot>Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('is-green');
    expect(container.querySelector('.cx-bdot')).toBeInTheDocument();
  });

  test('PageHeader and Panel render optional content', () => {
    render(<PageHeader eyebrow="Residents" title="Directory" lede="All residents" action={<button>Add</button>} />);
    render(<Panel title="Recent" action={<a href="#all">All</a>} pad>Body</Panel>);
    expect(screen.getByRole('heading', { name: 'Directory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeInTheDocument();
    expect(screen.getByText('Body')).toHaveStyle({ padding: '18px' });
  });

  test('StatCard and EmptyState render supplied icon and copy', () => {
    const Icon = (props) => <svg data-testid="icon" {...props} />;
    render(<><StatCard icon={Icon} label="Residents" value="12" delta="+2" deltaDir="up" /><EmptyState icon={Icon} title="Nothing here" note="Add a record" action={<button>Create</button>} /></>);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+2')).toHaveClass('up');
    expect(screen.getAllByTestId('icon')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });
});
