import { DEFAULT_COMPANY_CONFIG } from './companyConfig.example';

let activeConfig = DEFAULT_COMPANY_CONFIG;
try {
  // Yerel ortamda companyConfig.js varsa (gitignore altındaki gerçek veriler) onu kullanır
  const localConfig = require('./companyConfig');
  if (localConfig && (localConfig.COMPANY_CONFIG || localConfig.default)) {
    activeConfig = localConfig.COMPANY_CONFIG || localConfig.default;
  }
} catch (e) {
  // Dosya yoksa (GitHub'dan klonlanan ortamlarda) otomatik olarak örnek şablona düşer
  activeConfig = DEFAULT_COMPANY_CONFIG;
}

export const APP_COMPANY_CONFIG = activeConfig;
export default APP_COMPANY_CONFIG;
