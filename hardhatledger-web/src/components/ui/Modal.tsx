import { type ReactNode, useEffect } from 'react';
import { HiX } from 'react-icons/hi';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
}

const widths = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, width = 'md' }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="neu-modal-overlay" onClick={onClose}>
      <div className={`neu-modal ${widths[width]}`} onClick={(e) => e.stopPropagation()}>
        <div className="neu-modal-header">
          <h3 className="neu-modal-title">{title}</h3>
          <button onClick={onClose} className="neu-btn-icon">
            <HiX className="w-5 h-5" />
          </button>
        </div>
        <div className="neu-modal-body">{children}</div>
      </div>
    </div>
  );
}
