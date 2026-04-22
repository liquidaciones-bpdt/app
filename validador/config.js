/**
 * Configuration file for the Portal Validador.
 * Centralizes URLs and global constants.
 */

const CONFIG = {
    // Replace with your Google Apps Script Web App URL after deployment
    // Example: https://script.google.com/macros/s/AKfycbz.../exec
    WEB_APP_URL: "https://script.google.com/macros/s/REPLACE_WITH_YOUR_ID/exec",
    
    // UI Constants
    ROLES: {
        ADMIN: 'validador',
        USER: 'proveedor'
    },
    
    // Status Styles (Tailwind Classes)
    STATUS_CLASSES: {
        'PENDING': 'bg-slate-50 text-slate-500 border-slate-200',
        'APPROVED': 'bg-emerald-50 text-[#00B074] border-emerald-100',
        'REJECTED': 'bg-red-50 text-[#E30613] border-red-100',
        'OBSERVED': 'bg-orange-50 text-[#FFB300] border-orange-100'
    }
};

window.CONFIG = CONFIG;
