import { type InputHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm text-[#f5f0e8]/70">{label}</label>
        )}
        <input
          ref={ref}
          className={clsx(
            'bg-[#1a1a2e]/60 border border-[#c9a96e]/20 rounded-lg px-4 py-2.5',
            'text-[#f5f0e8] placeholder:text-[#f5f0e8]/30',
            'focus:outline-none focus:border-[#c9a96e]/60 focus:ring-1 focus:ring-[#c9a96e]/30',
            'transition-colors duration-200',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = 'Input';