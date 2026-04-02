import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 shadow-[0_2px_8px_rgba(27,58,92,0.08)] hover:shadow-[0_4px_16px_rgba(27,58,92,0.12)] transition-shadow ${className}`}
    >
      {children}
    </div>
  );
}
