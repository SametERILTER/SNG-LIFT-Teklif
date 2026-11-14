/**
 * SNG LIFT - Proposal Utilities
 * Teklif kayıtlarından motor modeli, adedi ve teknik özelliklerini ayıklar.
 */

export const getProposalMotors = (proposal) => {
  if (!proposal) return [];
  const payload = proposal.payload || proposal;
  const rawItems = payload.items || proposal.items || [];

  if (Array.isArray(rawItems) && rawItems.length > 0) {
    const validItems = rawItems.filter(
      it => it && (it.model || it.description || it.qty || it.adet || it.kg || it.kw || it.price)
    );

    if (validItems.length > 0) {
      return validItems.map((item, index) => {
        const qty = parseInt(item.qty || item.adet || 1, 10) || 1;
        let model = item.model || '';

        // Model yoksa fakat kaydedilmiş HTML'den description gelmişse temizle
        if (!model && item.description) {
          model = item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (!model) {
          model = 'Standart Asansör Motoru';
        }

        const specs = [];
        if (item.kg) specs.push(`${item.kg} Kg`);
        if (item.hiz) specs.push(`${item.hiz} m/s`);
        if (item.aski) specs.push(`${item.aski} Askı`);
        if (item.kasnak) specs.push(`Ø${item.kasnak} mm`);
        if (item.kw) specs.push(`${item.kw} kW`);
        if (item.amp) specs.push(`${item.amp} A`);
        if (item.detail && String(item.detail).trim()) {
          specs.push(String(item.detail).trim());
        }

        return {
          id: item.id || `motor-${index}`,
          qty,
          model,
          specs: specs.join(' • '),
          price: item.price,
          kg: item.kg || '',
          hiz: item.hiz || '',
          aski: item.aski || '',
          kasnak: item.kasnak || '',
          kw: item.kw || '',
          amp: item.amp || '',
          detail: item.detail || '',
          motorImageKey: item.motorImageKey || '',
          rawItem: item
        };
      });
    }
  }

  // Kalem dizisi olmayan veya eski kayıtlar için fallback
  const count = proposal.itemCount || payload.itemCount || 1;
  return [
    {
      id: 'default-1',
      qty: count,
      model: 'Standart Asansör Motoru',
      specs: '',
      price: proposal.grandTotal || payload.grandTotal || '',
      kg: '',
      hiz: '',
      aski: '',
      kasnak: '',
      kw: '',
      amp: '',
      detail: '',
      motorImageKey: '',
      rawItem: {}
    }
  ];
};

