/**
 * Tarih Ayrıştırıcı (DD.MM.YYYY veya timestamp id)
 */
export function parseProposalDate(tarihStr, id) {
  if (tarihStr && typeof tarihStr === 'string' && tarihStr.includes('.')) {
    const parts = tarihStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const tempDate = new Date(year, month, day);
      if (!isNaN(tempDate.getTime())) return tempDate;
    }
  }

  if (id) {
    const num = parseInt(id, 10);
    if (!isNaN(num) && num > 1000000000) {
      const tempDate = new Date(num);
      if (!isNaN(tempDate.getTime())) return tempDate;
    }
  }

  return new Date();
}

/**
 * Akıllı Tarih Biçimlendirici (Smart Date Formatter)
 * - Bugün ise: "Bugün"
 * - Dün ise: "Dün"
 * - Son 7 gün içindeyse: Günün adı (örn: "Pazartesi", "Cuma")
 * - 7 günden eskiyse: Tam tarih (örn: "07.09.2026")
 */
export function getSmartDateLabel(tarihStr, id) {
  const d = parseProposalDate(tarihStr, id);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const dayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  if (diffDays === 0) {
    return 'Bugün';
  }
  if (diffDays === 1) {
    return 'Dün';
  }
  if (diffDays > 1 && diffDays < 7) {
    return dayNames[d.getDay()];
  }

  if (tarihStr && typeof tarihStr === 'string' && tarihStr.includes('.')) {
    return tarihStr;
  }

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}
