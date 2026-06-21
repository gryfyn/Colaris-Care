'use client';
import { createContext, useContext, useState, useCallback } from 'react';

const AdmissionContext = createContext(null);

export function AdmissionProvider({ children }) {
  const [formData, setFormData] = useState({
    nursing: {},
    preScreening: {},
    advanceDirective: {},
  });

  const updateNursingData = useCallback((data) => {
    setFormData(prev => ({
      ...prev,
      nursing: { ...prev.nursing, ...data }
    }));
  }, []);

  const updatePreScreeningData = useCallback((data) => {
    setFormData(prev => ({
      ...prev,
      preScreening: { ...prev.preScreening, ...data }
    }));
  }, []);

  const updateAdvanceDirectiveData = useCallback((data) => {
    setFormData(prev => ({
      ...prev,
      advanceDirective: { ...prev.advanceDirective, ...data }
    }));
  }, []);

  const clearAllData = useCallback(() => {
    setFormData({
      nursing: {},
      preScreening: {},
      advanceDirective: {},
    });
  }, []);

  return (
    <AdmissionContext.Provider value={{
      formData,
      updateNursingData,
      updatePreScreeningData,
      updateAdvanceDirectiveData,
      clearAllData,
    }}>
      {children}
    </AdmissionContext.Provider>
  );
}

export function useAdmission() {
  const ctx = useContext(AdmissionContext);
  if (!ctx) throw new Error('useAdmission must be used within AdmissionProvider');
  return ctx;
}
