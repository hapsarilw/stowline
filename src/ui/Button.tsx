import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'border-accent bg-accent font-semibold text-onaccent hover:brightness-110 disabled:opacity-40',
  secondary:
    'border-border2 bg-raised font-medium text-text hover:border-text3 disabled:opacity-45',
  ghost: 'border-transparent text-accent hover:bg-accentbg disabled:opacity-45',
  danger: 'border-err text-err hover:bg-errbg disabled:opacity-45',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** 28 px high, 4 px radius, 1 px border. Hover, focus and disabled as in the components sheet. */
export function Button({
  variant = 'secondary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 disabled:cursor-default',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The accessible name. Required: the button has no text. */
  label: string;
  size?: 'sm' | 'md';
}

/** A 28 px (or 24 px) square button with an icon. */
export function IconButton({
  label,
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={props.title ?? label}
      className={cn(
        'grid cursor-pointer place-items-center rounded border border-transparent text-text2 hover:bg-hover hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text2',
        size === 'md' ? 'size-7' : 'size-6',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
