import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  flat?: boolean;
}

export function Card({ children, className = '', onClick, flat }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`${flat ? 'neu-card-flat' : 'neu-card'} ${className}`}
    >
      {children}
    </div>
  );
}
