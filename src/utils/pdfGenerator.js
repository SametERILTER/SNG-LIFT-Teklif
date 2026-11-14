import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { SNG_LOGO_BASE64 } from '../data/logoBase64';
import { getMotorImageBase64 } from '../data/motorImages';
import { APP_COMPANY_CONFIG } from '../config';

// Sayı formatlayıcı: 1275 -> 1.275,00 USD / TL / EUR
export const formatCurrency = (val, currency = 'USD') => {
  try {
    const curr = currency || 'USD';
    const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\./g, '').replace(',', '.') || '0');
    if (isNaN(num)) return `0,00 ${curr}`;
    return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ` ${curr}`;
  } catch {
    return `0,00 ${currency || 'USD'}`;
  }
};

export const generateProposalHTML = (data, options = {}) => {
  const { isEditable = true } = options;
  const raw = data?.payload || data || {};
  const {
    tarih = raw.tarih || '',
    teklifNo = raw.teklifNo || '',
    clientFirma = raw.clientFirma || raw.firma || '',
    clientYetkili = raw.clientYetkili || raw.yetkili || '',
    clientRef = raw.clientRef || '',
    items = raw.items || [],
    teslimSuresi = raw.teslimSuresi || 'STOK',
    odemeBilgisi = raw.odemeBilgisi || 'NAKİT',
    vendorFirma = raw.vendorFirma || APP_COMPANY_CONFIG.companyName,
    vendorYetkili = raw.vendorYetkili || APP_COMPANY_CONFIG.vendorYetkili,
    vendorTel = raw.vendorTel || APP_COMPANY_CONFIG.tel,
    vendorEmail = raw.vendorEmail || APP_COMPANY_CONFIG.phone || APP_COMPANY_CONFIG.email,
    vendorRef = raw.vendorRef || APP_COMPANY_CONFIG.ref,
    bankAccountTitle = raw.bankAccountTitle || APP_COMPANY_CONFIG.bankAccountTitle,
    garantiIban = raw.garantiIban || APP_COMPANY_CONFIG.garantiIban,
    vakifIban = raw.vakifIban || APP_COMPANY_CONFIG.vakifIban,
    ziraatIban = raw.ziraatIban || APP_COMPANY_CONFIG.ziraatIban,
    garantiUsdIban = raw.garantiUsdIban || APP_COMPANY_CONFIG.garantiUsdIban,
    vakifUsdIban = raw.vakifUsdIban || APP_COMPANY_CONFIG.vakifUsdIban,
    ziraatUsdIban = raw.ziraatUsdIban || APP_COMPANY_CONFIG.ziraatUsdIban,
    kdvRate = raw.kdvRate !== undefined ? raw.kdvRate : 20.0,
    currency = raw.currency || 'USD'
  } = raw;

  const effectiveClientRef = clientRef || (items || []).find(it => it.referans)?.referans || '';
  const currCode = currency || 'USD';

  const cleanTeslimSuresi = (teslimSuresi || 'STOK').toString().replace(/^TERMİN\s*:\s*/i, '').trim() || 'STOK';
  const cleanOdemeBilgisi = (odemeBilgisi || 'NAKİT').toString().replace(/^ÖDEME\s*:\s*/i, '').trim() || 'NAKİT';

  // Hesaplamalar
  const subtotal = (items || []).reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.price) || 0;
    return sum + (q * p);
  }, 0);
  const vat = subtotal * (kdvRate / 100.0);
  const grandTotal = subtotal + vat;

  // En az 8 satır tablo yapısı (Excel şablonundaki gibi)
  const totalRows = Math.max(8, (items || []).length);
  const rowsHTML = [];

  for (let i = 0; i < totalRows; i++) {
    if (i < (items || []).length) {
      const it = items[i];
      const q = parseFloat(it.qty) || 0;
      const p = parseFloat(it.price) || 0;
      const lineTotal = q * p;

      // Açıklama metnini dengeli iki satırda alt alta oluştur
      const line1Parts = [];
      if (it.model) line1Parts.push(`FURDER ${it.model}`);
      if (it.kg) line1Parts.push(`${it.kg} Kg`);
      if (it.hiz) line1Parts.push(`${it.hiz} m/s`);
      if (it.aski) line1Parts.push(`${it.aski} askı`);

      const line2Parts = [];
      if (it.kasnak) line2Parts.push(`${it.kasnak} mm`);
      if (it.kw) line2Parts.push(`${it.kw} kw`);
      if (it.amp) line2Parts.push(`${it.amp} amp.`);

      let descText = '';
      if (line1Parts.length > 0 && line2Parts.length > 0) {
        descText = `${line1Parts.join(' ')}<br/>${line2Parts.join(' ')}`;
      } else if (it.description) {
        descText = it.description;
      } else {
        descText = [...line1Parts, ...line2Parts].join(' ');
      }

      // İsteğe bağlı ürün detay bilgisi varsa motor bilgilerinin sonuna parantez içinde ekle
      const detailStr = String(it.detail || '').trim();
      if (detailStr) {
        descText = descText ? `${descText} (${detailStr})` : `(${detailStr})`;
      }

      // Motor Görseli (Yalnızca kullanıcı tarafından seçilmişse)
      const motorImg = it.motorImageKey
        ? getMotorImageBase64(it.motorImageKey)
        : null;

      const descContentHTML = motorImg
        ? `<div style="display: flex; align-items: center; justify-content: flex-start; min-height: 52px;">
            <img src="${motorImg}" alt="Motor" style="height: 50px; width: 68px; object-fit: contain; margin-right: 10px; border: none; background: transparent; flex-shrink: 0;" />
            <div style="flex: 1; text-align: left; line-height: 1.35;">${descText || '&nbsp;'}</div>
          </div>`
        : (descText || '&nbsp;');

      rowsHTML.push(`
        <tr data-item-row="true" data-row-index="${i}" ${motorImg ? 'style="height: 56px;"' : ''}>
          <td class="col-desc editable-cell" data-key="desc" ${motorImg ? 'style="padding-top: 3px; padding-bottom: 3px;"' : ''}>${descContentHTML}</td>
          <td class="col-qty editable-cell" data-key="qty">${q > 0 ? q : ''}</td>
          <td class="col-price editable-cell" data-key="price">${p > 0 ? formatCurrency(p, currCode) : ''}</td>
          <td class="col-total" data-key="total">${lineTotal > 0 ? formatCurrency(lineTotal, currCode) : `0,00 ${currCode}`}</td>
        </tr>
      `);
    } else {
      // Boş satır (Excel'deki gibi toplam sütununda 0,00 USD / TL / EUR yazar)
      rowsHTML.push(`
        <tr data-item-row="true" data-row-index="${i}">
          <td class="col-desc editable-cell" data-key="desc">&nbsp;</td>
          <td class="col-qty editable-cell" data-key="qty">&nbsp;</td>
          <td class="col-price editable-cell" data-key="price">&nbsp;</td>
          <td class="col-total" data-key="total">0,00 ${currCode}</td>
        </tr>
      `);
    }
  }

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=780, user-scalable=yes">
  <title>Teklif Formu - ${teklifNo}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html {
      width: 100%;
      background: #e9ecef;
    }
    body {
      font-family: 'Calibri', Arial, sans-serif;
      background: #e9ecef;
      color: #000000;
      font-size: 11px;
      line-height: 1.25;
      padding: 10px 0;
      margin: 0 auto;
      width: 780px;
      min-width: 780px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      width: 760px;
      min-width: 760px;
      margin: 0 auto;
      background: #ffffff;
      padding: 20px 18px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.12);
      position: relative;
    }
    @media print {
      html, body {
        background: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        min-width: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page-container {
        width: 100% !important;
        min-width: auto !important;
        padding: 0 1.5px !important;
        box-sizing: border-box !important;
        box-shadow: none !important;
        margin: 0 auto !important;
      }
      span.editable-field, div.editable-field {
        outline: none !important;
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
      }
      .editable-cell {
        outline: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }
      .info-table, .mat-table {
        border-collapse: collapse !important;
      }
      .info-table th, .info-table td {
        border: 1.2px solid #000000 !important;
      }
      .mat-table th, .mat-table td {
        border: 1.2px solid #000000 !important;
      }
      .mat-table .summary-row td.no-border,
      .mat-table .summary-row td[style*="border: none"] {
        border: none !important;
      }
      .exp-box {
        border: 1.2px solid #000000 !important;
      }
      .sign-box {
        border: 1.2px solid #000000 !important;
      }
    }

    /* Düzenleme Stilleri - Temiz Beyaz Arka Plan ve Kalın Belirgin Yeşil Çerçeveler */
    body.editing-active span.editable-field {
      display: inline-block;
      min-width: 36px;
      min-height: 18px;
      padding: 2px 7px;
      margin: 1px 0;
      background-color: #ffffff !important;
      background: #ffffff !important;
      border: 2.2px solid #107c41 !important;
      border-radius: 4px !important;
      box-shadow: 0 0 0 1px rgba(16, 124, 65, 0.18) !important;
      color: #000000 !important;
      cursor: text;
      transition: all 0.15s ease;
      vertical-align: middle;
      box-sizing: border-box;
    }
    body.editing-active div.editable-field {
      display: block;
      padding: 4px 8px;
      margin: 2px 0;
      background-color: #ffffff !important;
      background: #ffffff !important;
      border: 2.2px solid #107c41 !important;
      border-radius: 5px !important;
      box-shadow: 0 0 0 1px rgba(16, 124, 65, 0.18) !important;
      color: #000000 !important;
      cursor: text;
      transition: all 0.15s ease;
      box-sizing: border-box;
    }
    body.editing-active .editable-cell {
      background-color: #ffffff !important;
      background: #ffffff !important;
      outline: 2.2px solid #107c41 !important;
      outline-offset: -2px !important;
      border-radius: 3px !important;
      min-height: 22px;
      cursor: text;
      transition: all 0.15s ease;
    }
    body.editing-active span.editable-field:hover,
    body.editing-active div.editable-field:hover,
    body.editing-active .editable-cell:hover {
      background-color: #ffffff !important;
      background: #ffffff !important;
      border-color: #0b5a2e !important;
      outline-color: #0b5a2e !important;
    }
    body.editing-active span.editable-field:focus,
    body.editing-active div.editable-field:focus {
      outline: 2.8px solid #107c41 !important;
      outline-offset: 1px;
      border-color: #107c41 !important;
      background-color: #ffffff !important;
      background: #ffffff !important;
      box-shadow: 0 0 0 4px rgba(16, 124, 65, 0.3) !important;
      color: #000000 !important;
    }
    body.editing-active .editable-cell:focus {
      outline: 2.8px solid #107c41 !important;
      outline-offset: -2px !important;
      background-color: #ffffff !important;
      background: #ffffff !important;
      box-shadow: inset 0 0 0 2.5px rgba(16, 124, 65, 0.3) !important;
      color: #000000 !important;
    }

    /* 1. ÜST BAŞLIK ALANI (Logo Sol Sabit, Başlık Sayfa Genişliğinde Tam Ortada) */
    .top-header {
      width: 100%;
      min-height: 75px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .logo-img {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 160px;
      height: 70px;
      object-fit: contain;
      display: block;
      z-index: 2;
    }
    .top-header-text {
      width: 100%;
      text-align: center;
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 16px;
      color: #000000;
      letter-spacing: 0.2px;
      margin: 0 auto;
      z-index: 1;
    }

    /* 2. TARİH ALANI */
    .date-row {
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 11px;
      text-align: right;
      margin-bottom: 4px;
      color: #000000;
    }

    /* 3. TEKLİF FORMU BANNER */
    .banner-title {
      background-color: #eae2d5 !important;
      text-align: center;
      padding: 7px 0;
      margin-bottom: 4px;
      font-family: 'Aharoni', 'Century Gothic', Arial, sans-serif;
      font-size: 18px;
      font-weight: bold;
      color: #000000;
      letter-spacing: 0.5px;
    }

    /* 4. TEKLİF NO ALANI */
    .teklif-no-row {
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 11px;
      text-align: right;
      margin-bottom: 4px;
      color: #000000;
    }

    /* 5. MÜŞTERİ / TEKLİF VEREN TABLOSU */
    /* 5. MÜŞTERİ / TEKLİF VEREN TABLOSU */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-family: 'Century', 'Century Schoolbook', serif;
      font-size: 11px;
    }
    .info-table th, .info-table td {
      border: 1.2px solid #000000;
      padding: 3px 6px;
      vertical-align: middle;
    }
    .info-table th {
      font-weight: bold;
      text-align: center;
      background-color: #ffffff;
    }
    .info-table .col-lbl {
      width: 16%;
      font-weight: normal;
      text-align: left;
    }
    .info-table .col-talep {
      width: 42%;
      text-align: center;
    }
    .info-table .col-veren {
      width: 42%;
      text-align: center;
    }
    .ref-link {
      color: #0000ee;
      text-decoration: underline;
    }

    /* 6. MALZEMELER TABLOSU (Satır Yükseklikleri Artırıldı) */
    .mat-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .mat-table th {
      border: 1.2px solid #000000;
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 11px;
      text-align: center;
      padding: 6px 4px;
      background-color: #ffffff;
    }
    .mat-table td {
      border: 1.2px solid #000000;
      font-family: 'Century', 'Century Schoolbook', serif;
      font-weight: bold;
      font-size: 10px;
      padding: 6px 6px;
      height: 44px;
      vertical-align: middle;
    }
    .mat-table .col-desc {
      width: 53%;
      text-align: center;
      line-height: 1.35;
      font-size: 11px;
      font-weight: bold;
    }
    .mat-table .col-qty {
      width: 11%;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
    }
    .mat-table .col-price {
      width: 18%;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
    }
    .mat-table .col-total {
      width: 18%;
      text-align: center;
      font-size: 11px;
      font-weight: bold;
    }

    /* Özet Satırları (STOK, TOPLAM, KDV, GENEL TOPLAM) */
    .summary-row td {
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 11px;
      padding: 5px 6px;
      height: 26px;
    }
    .stok-cell {
      text-align: left;
      padding-left: 8px !important;
      font-family: 'Calibri', Arial, sans-serif !important;
      font-weight: bold !important;
      font-size: 11px !important;
    }
    .sum-lbl {
      text-align: center;
      font-family: 'Calibri', Arial, sans-serif !important;
      font-weight: bold;
      font-size: 11px;
    }
    .sum-val {
      text-align: center;
      font-family: 'Century', 'Century Schoolbook', serif !important;
      font-weight: bold;
      font-size: 11px;
    }

    /* 7. AÇIKLAMALAR BÖLÜMÜ */
    .exp-title {
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 11px;
      margin-bottom: 2px;
      margin-top: 3px;
    }
    .exp-box {
      border: 1.2px solid #000000;
      padding: 4px 7px;
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 10px;
      line-height: 1.25;
      margin-bottom: 6px;
    }
    .exp-line {
      margin-bottom: 1.5px;
      font-weight: bold;
    }
    .bank-row {
      display: flex;
      align-items: center;
      margin-bottom: 1.5px;
      line-height: 1.25;
      white-space: nowrap;
    }
    .bank-lbl {
      display: inline-block;
      width: 165px;
      min-width: 165px;
      vertical-align: middle;
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 10px;
    }
    .bank-iban {
      display: inline-block;
      vertical-align: middle;
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 10px;
      letter-spacing: 0.2px;
    }

    /* 8. ONAY KUTULARI (MÜŞTERİ & FİRMA ONAY - YANLARA HİZALI) */
    .sign-container {
      width: 100%;
      margin-top: 4px;
    }
    .sign-table {
      width: 100%;
      border-collapse: collapse;
      border: none;
    }
    .sign-table td {
      border: none;
      width: 50%;
      vertical-align: top;
      padding: 0;
    }
    .sign-cell-left {
      width: 76%;
      margin-left: 0;
      margin-right: auto;
    }
    .sign-cell-right {
      width: 76%;
      margin-left: auto;
      margin-right: 0;
    }
    .sign-title {
      font-family: 'Calibri', Arial, sans-serif;
      font-weight: bold;
      font-size: 11px;
      text-align: center;
      margin-bottom: 3px;
    }
    .sign-box {
      border: 1.2px solid #000000;
      height: 50px;
      width: 100%;
    }
  </style>
</head>
<body class="${isEditable ? 'editing-active' : ''}">
  <div class="page-container" id="printable-area">

    <!-- 1. ÜST BAŞLIK: LOGO & YATAYDA TAM ORTALI FURDER TÜRKİYE YETKİLİ SATICISI -->
    <div class="top-header">
      <img src="${SNG_LOGO_BASE64}" class="logo-img" alt="SNG LIFT" />
      <div class="top-header-text">FURDER TÜRKİYE YETKİLİ SATICISI</div>
    </div>

    <!-- 2. TARİH -->
    <div class="date-row">
      TARİH: <span class="editable-field" id="field-tarih" data-key="tarih">${tarih}</span>
    </div>

    <!-- 3. TEKLİF FORMU BANNER -->
    <div class="banner-title">
      TEKLİF FORMU
    </div>

    <!-- 4. TEKLİF NO -->
    <div class="teklif-no-row">
      TEKLİF NO : <span class="editable-field" id="field-teklifNo" data-key="teklifNo">${teklifNo}</span>
    </div>

    <!-- 5. TALEP EDEN / TEKLİF VEREN TABLOSU -->
    <table class="info-table">
      <tr>
        <th class="col-lbl">&nbsp;</th>
        <th class="col-talep">TALEP EDEN</th>
        <th class="col-veren">TEKLİF VEREN</th>
      </tr>
      <tr>
        <td class="col-lbl">FİRMA</td>
        <td class="col-talep"><span class="editable-field" id="field-clientFirma" data-key="clientFirma">${(clientFirma || '').toUpperCase()}</span></td>
        <td class="col-veren"><span class="editable-field" id="field-vendorFirma" data-key="vendorFirma">${(vendorFirma || APP_COMPANY_CONFIG.companyName).toUpperCase()}</span></td>
      </tr>
      <tr>
        <td class="col-lbl">YETKİLİ</td>
        <td class="col-talep"><span class="editable-field" id="field-clientYetkili" data-key="clientYetkili">${(clientYetkili || '').toUpperCase()}</span></td>
        <td class="col-veren"><span class="editable-field" id="field-vendorYetkili" data-key="vendorYetkili">${(vendorYetkili || APP_COMPANY_CONFIG.vendorYetkili).toUpperCase()}</span></td>
      </tr>
      <tr>
        <td class="col-lbl">TEL</td>
        <td class="col-talep"><span class="editable-field" id="field-clientTel" data-key="clientTel">${data?.clientTel || '&nbsp;'}</span></td>
        <td class="col-veren"><span class="editable-field" id="field-vendorTel" data-key="vendorTel">${vendorTel || APP_COMPANY_CONFIG.tel}</span></td>
      </tr>
      <tr>
        <td class="col-lbl">E-MAİL</td>
        <td class="col-talep"><span class="editable-field" id="field-clientEmail" data-key="clientEmail">${data?.clientEmail || '&nbsp;'}</span></td>
        <td class="col-veren"><span class="editable-field" id="field-vendorEmail" data-key="vendorEmail">${vendorEmail || APP_COMPANY_CONFIG.email}</span></td>
      </tr>
      <tr>
        <td class="col-lbl">REFERANS</td>
        <td class="col-talep"><span class="editable-field" id="field-clientRef" data-key="clientRef">${effectiveClientRef ? effectiveClientRef.toUpperCase() : '&nbsp;'}</span></td>
        <td class="col-veren"><span class="ref-link editable-field" id="field-vendorRef" data-key="vendorRef">${vendorRef || APP_COMPANY_CONFIG.ref}</span></td>
      </tr>
    </table>

    <!-- 6. MALZEMELER TABLOSU -->
    <table class="mat-table">
      <thead>
        <tr>
          <th style="width: 53%;">MALZEME ADI VE AÇIKLAMASI</th>
          <th style="width: 11%;">MİKTAR</th>
          <th style="width: 18%;">FİYAT</th>
          <th style="width: 18%;">TOPLAM FİYAT</th>
        </tr>
      </thead>
      <tbody id="materials-tbody">
        ${rowsHTML.join('')}

        <!-- STOK VE TOPLAM SATIRI -->
        <tr class="summary-row">
          <td colspan="2" class="stok-cell editable-cell" id="field-teslimSuresi" data-key="teslimSuresi">TERMİN : ${cleanTeslimSuresi.toUpperCase()}</td>
          <td class="sum-lbl">TOPLAM</td>
          <td class="sum-val" id="subtotal-val">${formatCurrency(subtotal, currCode)}</td>
        </tr>

        <!-- KDV SATIRI (ÖDEME BİLGİSİ) -->
        <tr class="summary-row">
          <td colspan="2" class="stok-cell editable-cell" id="field-odemeBilgisi" data-key="odemeBilgisi">ÖDEME : ${cleanOdemeBilgisi.toUpperCase()}</td>
          <td class="sum-lbl">KDV %<span class="editable-field" id="field-kdvRate" data-key="kdvRate">${Math.round(kdvRate)}</span>=</td>
          <td class="sum-val" id="vat-val">${formatCurrency(vat, currCode)}</td>
        </tr>

        <!-- GENEL TOPLAM SATIRI (KARGO BİLGİSİ) -->
        <tr class="summary-row">
          <td colspan="2" class="stok-cell editable-cell" id="field-kargoBilgisi" data-key="kargoBilgisi">KARGO VE NAKLİYE ÜCRETİ ALICIYA AİTTİR.</td>
          <td class="sum-lbl">GENEL TOPLAM</td>
          <td class="sum-val" id="grandtotal-val">${formatCurrency(grandTotal, currCode)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 7. AÇIKLAMALAR -->
    <div class="exp-title">AÇIKLAMALAR</div>
    <div class="exp-box" id="exp-box">
      <div class="exp-line editable-field" id="field-exp3" data-key="exp-3" style="margin-bottom: 2.5px; font-weight: 900;"><b style="font-weight: 900;">BANKA HESAP BİLGİSİ :</b> <b style="font-weight: 900;">${bankAccountTitle || APP_COMPANY_CONFIG.bankAccountTitle}</b></div>
      <div class="bank-row">
        <span class="bank-lbl">GARANTİ BANKASI (TL)&nbsp;&nbsp;:</span>
        <span class="bank-iban editable-field" id="field-exp4" data-key="exp-4">${garantiIban || APP_COMPANY_CONFIG.garantiIban}</span>
      </div>
      <div class="bank-row">
        <span class="bank-lbl">VAKIFBANK (TL)&nbsp;&nbsp;:</span>
        <span class="bank-iban editable-field" id="field-exp5" data-key="exp-5">${vakifIban || APP_COMPANY_CONFIG.vakifIban}</span>
      </div>
      <div class="bank-row">
        <span class="bank-lbl">ZİRAAT BANKASI (TL)&nbsp;&nbsp;:</span>
        <span class="bank-iban editable-field" id="field-exp6" data-key="exp-6">${ziraatIban || APP_COMPANY_CONFIG.ziraatIban}</span>
      </div>
      <div class="bank-row">
        <span class="bank-lbl">GARANTİ BANKASI (USD)&nbsp;&nbsp;:</span>
        <span class="bank-iban editable-field" id="field-exp7" data-key="exp-7">${garantiUsdIban || APP_COMPANY_CONFIG.garantiUsdIban}</span>
      </div>
      <div class="bank-row">
        <span class="bank-lbl">VAKIFBANK (USD)&nbsp;&nbsp;:</span>
        <span class="bank-iban editable-field" id="field-exp8" data-key="exp-8">${vakifUsdIban || APP_COMPANY_CONFIG.vakifUsdIban}</span>
      </div>
      <div class="bank-row">
        <span class="bank-lbl">ZİRAAT BANKASI (USD)&nbsp;&nbsp;:</span>
        <span class="bank-iban editable-field" id="field-exp9" data-key="exp-9">${ziraatUsdIban || APP_COMPANY_CONFIG.ziraatUsdIban}</span>
      </div>
    </div>

    <!-- 8. ONAY KUTULARI (YANLARA HİZALI) -->
    <div class="sign-container">
      <table class="sign-table">
        <tr>
          <td>
            <div class="sign-cell-left">
              <div class="sign-title">MÜŞTERİ ONAY</div>
              <div class="sign-box"></div>
            </div>
          </td>
          <td>
            <div class="sign-cell-right">
              <div class="sign-title">FİRMA ONAY</div>
              <div class="sign-box"></div>
            </div>
          </td>
        </tr>
      </table>
    </div>

  </div>

  <!-- CANLI FORMÜL VE HESAPLAMA SCRIPTI -->
  <script>
    (function() {
      var isEditingActive = ${isEditable ? 'true' : 'false'};
      var CURRENCY_CODE = "${currCode}";

      function parseNumber(text) {
        if (!text) return 0;
        var str = text.replace(/[^0-9.,-]/g, '').trim();
        if (!str) return 0;
        if (str.indexOf(',') !== -1 && str.indexOf('.') !== -1) {
          if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            str = str.replace(/\\./g, '').replace(',', '.');
          } else {
            str = str.replace(/,/g, '');
          }
        } else if (str.indexOf(',') !== -1) {
          str = str.replace(',', '.');
        }
        var num = parseFloat(str);
        return isNaN(num) ? 0 : num;
      }

      function formatCurr(num) {
        var n = typeof num === 'number' ? num : parseFloat(num) || 0;
        return n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CURRENCY_CODE;
      }

      function recalculateAll() {
        var rows = document.querySelectorAll('tr[data-item-row="true"]');
        var subtotal = 0;

        rows.forEach(function(row) {
          var qtyCell = row.querySelector('.col-qty');
          var priceCell = row.querySelector('.col-price');
          var totalCell = row.querySelector('.col-total');
          if (!qtyCell || !priceCell || !totalCell) return;

          var q = parseNumber(qtyCell.innerText);
          var p = parseNumber(priceCell.innerText);
          var lineTotal = q * p;
          subtotal += lineTotal;

          if (q > 0 || p > 0) {
            totalCell.innerText = formatCurr(lineTotal);
          } else {
            totalCell.innerText = '0,00 ' + CURRENCY_CODE;
          }
        });

        var kdvRateEl = document.getElementById('field-kdvRate');
        var kdvRate = kdvRateEl ? (parseNumber(kdvRateEl.innerText) || 20) : 20;
        var vat = subtotal * (kdvRate / 100.0);
        var grandTotal = subtotal + vat;

        var subtotalEl = document.getElementById('subtotal-val');
        if (subtotalEl) subtotalEl.innerText = formatCurr(subtotal);

        var vatEl = document.getElementById('vat-val');
        if (vatEl) vatEl.innerText = formatCurr(vat);

        var grandTotalEl = document.getElementById('grandtotal-val');
        if (grandTotalEl) grandTotalEl.innerText = formatCurr(grandTotal);

        sendSyncMessage({
          subtotal: subtotal,
          vat: vat,
          grandTotal: grandTotal,
          kdvRate: kdvRate
        });
      }

      function sendSyncMessage(extraData) {
        try {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            var payload = {
              type: 'SYNC_UPDATE',
              html: document.documentElement.outerHTML,
              totals: extraData || {}
            };
            window.ReactNativeWebView.postMessage(JSON.stringify(payload));
          }
        } catch (e) {}
      }

      function setEditing(enabled) {
        isEditingActive = enabled;
        if (enabled) {
          document.body.classList.add('editing-active');
        } else {
          document.body.classList.remove('editing-active');
        }
        var editables = document.querySelectorAll('.editable-cell, .editable-field');
        editables.forEach(function(el) {
          el.setAttribute('contenteditable', enabled ? 'true' : 'false');
        });
      }

      // Initial setup
      setEditing(isEditingActive);

      // Event Listeners for dynamic inputs
      document.addEventListener('input', function(e) {
        if (!isEditingActive) return;
        var target = e.target;
        if (target.classList.contains('col-qty') || target.classList.contains('col-price') || target.id === 'field-kdvRate') {
          recalculateAll();
        } else {
          sendSyncMessage();
        }
      });

      document.addEventListener('blur', function(e) {
        var target = e.target;
        if (target.classList.contains('col-price')) {
          var p = parseNumber(target.innerText);
          if (p > 0) {
            target.innerText = formatCurr(p);
          }
          recalculateAll();
        } else if (target.classList.contains('col-qty')) {
          var q = parseNumber(target.innerText);
          if (q > 0) {
            target.innerText = q.toString();
          }
          recalculateAll();
        }
      }, true);

      // Global window bridge
      window.setEditingMode = setEditing;
      window.setCurrencyCode = function(newCurr) {
        if (!newCurr) return;
        CURRENCY_CODE = newCurr;
        recalculateAll();
      };
      window.getCleanHTML = function() {
        var clone = document.documentElement.cloneNode(true);
        clone.querySelector('body').classList.remove('editing-active');
        var editables = clone.querySelectorAll('[contenteditable]');
        editables.forEach(function(el) { el.removeAttribute('contenteditable'); });
        return '<!DOCTYPE html>\\n' + clone.outerHTML;
      };

      window.saveAndExtractData = function() {
        setEditing(false);
        var clone = document.documentElement.cloneNode(true);
        clone.querySelector('body').classList.remove('editing-active');
        var editables = clone.querySelectorAll('[contenteditable]');
        editables.forEach(function(el) { el.removeAttribute('contenteditable'); });

        var clientFirma = document.getElementById('field-clientFirma') ? document.getElementById('field-clientFirma').innerText.trim() : '';
        var clientYetkili = document.getElementById('field-clientYetkili') ? document.getElementById('field-clientYetkili').innerText.trim() : '';
        var clientTel = document.getElementById('field-clientTel') ? document.getElementById('field-clientTel').innerText.trim() : '';
        var clientEmail = document.getElementById('field-clientEmail') ? document.getElementById('field-clientEmail').innerText.trim() : '';
        var clientRef = document.getElementById('field-clientRef') ? document.getElementById('field-clientRef').innerText.trim() : '';

        var vendorFirma = document.getElementById('field-vendorFirma') ? document.getElementById('field-vendorFirma').innerText.trim() : '';
        var vendorYetkili = document.getElementById('field-vendorYetkili') ? document.getElementById('field-vendorYetkili').innerText.trim() : '';
        var vendorTel = document.getElementById('field-vendorTel') ? document.getElementById('field-vendorTel').innerText.trim() : '';
        var vendorEmail = document.getElementById('field-vendorEmail') ? document.getElementById('field-vendorEmail').innerText.trim() : '';
        var vendorRef = document.getElementById('field-vendorRef') ? document.getElementById('field-vendorRef').innerText.trim() : '';

        var tarih = document.getElementById('field-tarih') ? document.getElementById('field-tarih').innerText.trim() : '';
        var teklifNo = document.getElementById('field-teklifNo') ? document.getElementById('field-teklifNo').innerText.trim() : '';
        var teslimSuresiEl = document.getElementById('field-teslimSuresi');
        var teslimSuresi = teslimSuresiEl ? teslimSuresiEl.innerText.replace(/^TERMİN\s*:\s*/i, '').trim() : '';
        var odemeBilgisiEl = document.getElementById('field-odemeBilgisi');
        var odemeBilgisi = odemeBilgisiEl ? odemeBilgisiEl.innerText.replace(/^ÖDEME\s*:\s*/i, '').trim() : '';

        var kdvRateEl = document.getElementById('field-kdvRate');
        var kdvRate = kdvRateEl ? (parseNumber(kdvRateEl.innerText) || 20) : 20;

        var subtotalEl = document.getElementById('subtotal-val');
        var subtotal = subtotalEl ? parseNumber(subtotalEl.innerText) : 0;
        var vatEl = document.getElementById('vat-val');
        var vat = vatEl ? parseNumber(vatEl.innerText) : 0;
        var grandEl = document.getElementById('grandtotal-val');
        var grandTotal = grandEl ? parseNumber(grandEl.innerText) : 0;

        var extractedItems = [];
        var rows = document.querySelectorAll('tr[data-item-row="true"]');
        rows.forEach(function(row) {
          var descCell = row.querySelector('.col-desc');
          var qtyCell = row.querySelector('.col-qty');
          var priceCell = row.querySelector('.col-price');
          var totalCell = row.querySelector('.col-total');

          var desc = descCell ? descCell.innerText.trim() : '';
          var q = qtyCell ? parseNumber(qtyCell.innerText) : 0;
          var p = priceCell ? parseNumber(priceCell.innerText) : 0;
          var t = totalCell ? parseNumber(totalCell.innerText) : (q * p);

          if (desc || q > 0 || p > 0) {
            extractedItems.push({
              description: desc,
              qty: q > 0 ? q : 1,
              price: p,
              total: t
            });
          }
        });

        var cleanDocHTML = '<!DOCTYPE html>\\n' + clone.outerHTML;

        var msg = {
          type: 'SAVE_AND_EXIT',
          cleanHTML: cleanDocHTML,
          rawHTML: document.documentElement.outerHTML,
          extracted: {
            clientFirma: clientFirma,
            clientYetkili: clientYetkili,
            clientTel: clientTel,
            clientEmail: clientEmail,
            clientRef: clientRef,
            vendorFirma: vendorFirma,
            vendorYetkili: vendorYetkili,
            vendorTel: vendorTel,
            vendorEmail: vendorEmail,
            vendorRef: vendorRef,
            tarih: tarih,
            teklifNo: teklifNo,
            teslimSuresi: teslimSuresi,
            odemeBilgisi: odemeBilgisi,
            kdvRate: kdvRate,
            currency: CURRENCY_CODE,
            subtotal: subtotal,
            vat: vat,
            grandTotal: grandTotal,
            items: extractedItems
          }
        };

        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      };

    })();
  </script>
</body>
</html>
  `;
};

// PDF Oluştur ve Paylaş / Yazdır
export const exportAndSharePDF = async (proposalData, customHTML = null) => {
  try {
    const rawData = proposalData?.payload || proposalData || {};
    let htmlContent = customHTML || proposalData?.savedHTML || rawData?.savedHTML || generateProposalHTML(rawData, { isEditable: false });

    // HTML içinde düzenleme sınıflarını temizle
    htmlContent = htmlContent.replace(/class="([^"]*)\bediting-active\b([^"]*)"/g, 'class="$1$2"');
    htmlContent = htmlContent.replace(/contenteditable="true"/g, '');

    // Eski şablonlarda veya kayıtlarda kalmış ızgara çizgilerini yok eden kuralı düzelt
    htmlContent = htmlContent.replace(
      /\.editable-cell,\s*\.editable-field\s*\{\s*outline:\s*none\s*!important;\s*border:\s*none\s*!important;[^}]*\}/gi,
      'span.editable-field, div.editable-field { outline: none !important; border: none !important; background: transparent !important; box-shadow: none !important; } .editable-cell { outline: none !important; box-shadow: none !important; } .mat-table th, .mat-table td { border: 1.2px solid #000000 !important; } .info-table th, .info-table td { border: 1.2px solid #000000 !important; }'
    );

    // WEB TARAYICISI İÇİN (Chrome, Edge vb.)
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 300);
      }
      return { success: true };
    }

    // MOBİL İÇİN (Android & iOS): Hızlı ve güvenli PDF dosyası oluşturma
    const printResult = await Print.printToFileAsync({
      html: htmlContent,
      base64: true
    });

    const safeTeklifNo = String(rawData?.teklifNo || proposalData?.teklifNo || 'Teklif').replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    const destinationUri = `${targetDir}Teklif_${safeTeklifNo}_${Date.now()}.pdf`;
    let shareUri = destinationUri;

    try {
      if (printResult.base64) {
        await FileSystem.writeAsStringAsync(destinationUri, printResult.base64, {
          encoding: FileSystem.EncodingType.Base64
        });
      } else {
        await FileSystem.copyAsync({
          from: printResult.uri,
          to: destinationUri
        });
      }
    } catch (writeErr) {
      console.log('PDF dosya kaydetme uyarısı:', writeErr);
      shareUri = printResult.uri;
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(shareUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Teklif No: ${rawData?.teklifNo || proposalData?.teklifNo || 'Teklif'}`
      });
      return { success: true, uri: shareUri };
    } else {
      Alert.alert('PDF Oluşturuldu', `Dosya konumu: ${shareUri}`);
      return { success: true, uri: shareUri };
    }
  } catch (error) {
    console.error('PDF hatası:', error);
    Alert.alert('Hata', 'PDF işlemi gerçekleştirilemedi: ' + (error?.message || error));
    return { success: false, error };
  }
};

// PDF Önizleme
export const previewPDF = async (proposalData, customHTML = null) => {
  try {
    let htmlContent = customHTML || generateProposalHTML(proposalData, { isEditable: false });

    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
      }
      return;
    }

    await Print.printAsync({
      html: htmlContent
    });
  } catch (error) {
    console.error('Önizleme hatası:', error);
    Alert.alert('Önizleme Hatası', 'Önizleme yüklenemedi: ' + error.message);
  }
};
