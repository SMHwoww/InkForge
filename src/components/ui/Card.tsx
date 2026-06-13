import { type HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = false, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-[#2d4a3e]/60 backdrop-blur-sm border border-[#c9a96e]/10 rounded-xl p-5',
        hover && 'hover:border-[#c9a96e]/30 hover:shadow-lg hover:shadow-[#c9a96e]/5 hover:-translate-y-0.5 transition-all duration-300',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}