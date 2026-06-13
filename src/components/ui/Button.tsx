import { type ButtonHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'rounded-lg font-medium transition-all duration-200 inline-flex items-center justify-center gap-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-[#c9a96e] text-[#1a1a2e] hover:bg-[#d4b87a] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0':
            variant === 'primary',
          'border border-[#c9a96e]/40 text-[#c9a96e] hover:bg-[#c9a96e]/10 hover:border-[#c9a96e]':
            variant === 'secondary',
          'text-[#c9a96e]/70 hover:text-[#c9a96e] hover:bg-[#c9a96e]/5':
            variant === 'ghost',
          'bg-red-900/40 text-red-300 border border-red-800/50 hover:bg-red-900/60':
            variant === 'danger',
        },
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-5 py-2.5 text-sm': size === 'md',
          'px-7 py-3 text-base': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}