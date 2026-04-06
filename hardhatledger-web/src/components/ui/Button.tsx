import { type ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'amber';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantMap = {
  primary: 'neu-btn neu-btn-primary',
  secondary: 'neu-btn neu-btn-secondary',
  danger: 'neu-btn neu-btn-danger',
  outline: 'neu-btn neu-btn-outline',
  amber: 'neu-btn neu-btn-primary',
};

const sizeMap = {
  sm: 'neu-btn-sm',
  md: '',
  lg: 'neu-btn-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, disabled, className = '', ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${variantMap[variant]} ${sizeMap[size]} ${className}`}
      {...props}
    >
      {loading && <span className="neu-spinner neu-spinner-sm" style={{ marginRight: '0.5rem' }} />}
      {children}
    </button>
  )
);
