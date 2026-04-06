export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'neu-spinner-sm', md: 'neu-spinner-md', lg: 'neu-spinner-lg' };
  return (
    <div className="flex items-center justify-center p-4">
      <span className={`neu-spinner ${sizes[size]}`} />
    </div>
  );
}
