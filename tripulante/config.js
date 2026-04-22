/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// CENTRALIZED CONFIGURATION
const CONFIG = {
  // REPLACE THIS with your deployed GAS Web App URL
  // Example: "https://script.google.com/macros/s/AKfyc.../exec"
  BACKEND_URL: "MY_APPS_SCRIPT_WEB_APP_URL",
  
  // App Constants
  DNI_LENGTH: 8,
  APP_VERSION: "2.0.0"
};

// Export if using modules (optional), but for vanilla we'll just keep it global
window.CONFIG = CONFIG;
