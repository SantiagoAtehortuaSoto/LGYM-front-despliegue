import { useEffect } from 'react';
import { CheckCircle, X, AlertCircle } from 'lucide-react';

const NotificationModal = ({ isOpen, onClose, type, message }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`${bgColor} text-white px-6 py-4 rounded-lg shadow-lg flex items-center`}>
        <Icon className="h-6 w-6 mr-2" />
        <span>{message}</span>
        <button 
          onClick={onClose} 
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
          aria-label="Cerrar notificación"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default NotificationModal;
