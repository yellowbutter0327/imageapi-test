import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'icon';
};
export function Button({
  variant = 'primary',
  size = 'default',
  className = '',
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${size === 'icon' ? 'button-icon' : ''} ${className}`}
      {...props}
    />
  );
}
