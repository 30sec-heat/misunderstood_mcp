import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = '' }: CardProps) {
  return (
    <div className={`card-base ${className}`}>
      {title && (
        <h3 className="mb-3 border-b border-dark-border pb-2 font-sans text-sm font-semibold uppercase tracking-wider text-gray-300">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
