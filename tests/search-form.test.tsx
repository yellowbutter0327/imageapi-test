import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { SearchForm } from '@/features/search-images';

it('keeps draft input separate until submit and trims whitespace', async () => {
  const user = userEvent.setup();
  const onSearch = vi.fn();
  render(<SearchForm initialQuery="티셔츠" onSearch={onSearch} />);
  const input = screen.getByRole('searchbox', { name: '이미지 검색어' });
  await user.clear(input);
  await user.type(input, '  포스터  ');
  expect(onSearch).not.toHaveBeenCalled();
  await user.keyboard('{Enter}');
  expect(onSearch).toHaveBeenCalledExactlyOnceWith('포스터');
});

it('prevents whitespace-only search and premature hydration requests', () => {
  const onSearch = vi.fn();
  const view = render(<SearchForm initialQuery="  " onSearch={onSearch} />);
  expect(screen.getByRole('button', { name: /^검색$/ })).toBeDisabled();
  fireEvent.submit(screen.getByRole('search'));
  expect(onSearch).not.toHaveBeenCalled();
  view.rerender(
    <SearchForm initialQuery="티셔츠" onSearch={onSearch} ready={false} />,
  );
  expect(screen.getByRole('button', { name: '티셔츠' })).toBeDisabled();
});
