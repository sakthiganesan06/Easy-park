export default function Card({ children, className = '', hover = false, glow = false, ...props }) {
  return (
    <div
      className={`
        ${hover ? 'glass-card-hover' : 'glass-card'}
        ${glow ? 'animate-glow' : ''}
        p-5
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
