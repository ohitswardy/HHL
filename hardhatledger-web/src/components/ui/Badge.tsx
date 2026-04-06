interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const variantMap = {
  success: 'neu-badge neu-badge-success',
  warning: 'neu-badge neu-badge-warning',
  danger: 'neu-badge neu-badge-danger',
  info: 'neu-badge neu-badge-info',
  neutral: 'neu-badge neu-badge-neutral',
};

export function Badge({ children, variant = 'neutral' }: BadgeProps) {
  return (
    <span className={variantMap[variant]}>
      {children}
    </span>
  );
}
