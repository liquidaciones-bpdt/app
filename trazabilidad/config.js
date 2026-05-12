/**
 * HT-BPDT | Configuration
 */

const CONFIG = {
  // REEMPLAZAR con la URL de tu Web App desplegada en Google Apps Script
  // Ejemplo: https://script.google.com/macros/s/AKfycb.../exec
  API_URL: 'TU_WEB_APP_URL_AQUI',
  
  APP_NAME: 'HT-BPDT | Trazabilidad Climatizada',
  VERSION: '1.0.0',
  
  // Maestro de colores para estados
  COLORS: {
    'CUMPLE': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'NO_CUMPLE': 'bg-red-100 text-red-700 border-red-200',
    'PENDIENTE': 'bg-slate-100 text-slate-500 border-slate-200',
    'REGISTRADO': 'bg-blue-100 text-blue-700 border-blue-200',
    'OBSERVADO': 'bg-amber-100 text-amber-700 border-amber-200',
    'CERRADO': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'ANULADO': 'bg-slate-300 text-slate-700 border-slate-400',
    'ABIERTA': 'bg-red-50 text-red-600 border-red-100',
    'EN_SEGUIMIENTO': 'bg-amber-50 text-amber-600 border-amber-100',
    'CERRADA': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'REPORTADA': 'bg-blue-50 text-blue-600 border-blue-100',
    'SIN_INCIDENCIA': 'bg-slate-50 text-slate-400 border-slate-100'
  }
};
