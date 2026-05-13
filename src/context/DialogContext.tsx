import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, HelpCircle } from 'lucide-react';

type DialogType = 'alert' | 'confirm';

interface DialogOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type: DialogType;
}

interface DialogContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const [resolver, setResolver] = useState<((value: any) => void) | null>(null);

  const showAlert = useCallback((message: string, title: string = 'Notification') => {
    return new Promise<void>((resolve) => {
      setDialog({ message, title, type: 'alert' });
      setResolver(() => resolve);
    });
  }, []);

  const showConfirm = useCallback((message: string, title: string = 'Confirm Action') => {
    return new Promise<boolean>((resolve) => {
      setDialog({ message, title, type: 'confirm' });
      setResolver(() => resolve);
    });
  }, []);

  const handleClose = (value: any) => {
    if (resolver) {
      resolver(value);
    }
    setDialog(null);
    setResolver(null);
  };

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <AnimatePresence>
        {dialog && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100"
            >
              <div className="p-8 pt-10">
                <div className="flex justify-center mb-6">
                  <div className={`p-4 rounded-3xl ${dialog.type === 'alert' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                    {dialog.type === 'alert' ? <AlertCircle className="w-10 h-10" /> : <HelpCircle className="w-10 h-10" />}
                  </div>
                </div>
                <h3 className="text-2xl font-black text-[#004275] text-center mb-3 tracking-tight">{dialog.title}</h3>
                <p className="text-gray-500 text-center font-bold leading-relaxed px-2">{dialog.message}</p>
              </div>
              <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                {dialog.type === 'confirm' && (
                  <button
                    onClick={() => handleClose(false)}
                    className="flex-1 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-400 hover:bg-white hover:text-gray-600 transition-all active:scale-95"
                  >
                    {dialog.cancelLabel || 'Cancel'}
                  </button>
                )}
                <button
                  onClick={() => handleClose(true)}
                  className="flex-1 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-[#004275] text-white shadow-xl shadow-[#004275]/20 hover:bg-[#005a9c] hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  {dialog.confirmLabel || (dialog.type === 'alert' ? 'Got it' : 'Confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used within a DialogProvider');
  return context;
};
