import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, mono, className = '', ...props }, ref) => (
    <div className="w-full">
      {label && <label className="neu-label">{label}</label>}
      <div className={`neu-inset ${error ? 'shadow-[inset_3px_3px_6px_var(--n-shadow-dark-sm),inset_-3px_-3px_6px_var(--n-shadow-light-sm),0_0_0_1.5px_var(--n-danger)]' : ''}`}>
        <input
          ref={ref}
          className={`neu-input ${mono ? 'neu-input-mono' : ''} ${className}`}
          {...props}
        />
      </div>
      {error && <p className="neu-error">{error}</p>}
    </div>
  )
);
