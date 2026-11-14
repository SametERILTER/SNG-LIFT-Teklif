import React from 'react';
import {
  StyleSheet,
  Text,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MS } from '../constants/theme';
import { getProposalMotors } from '../utils/proposalUtils';

// Para birimi formatlayıcı
const defaultFormatPrice = (val, currency = 'USD') => {
  if (val === undefined || val === null || val === '') return '-';
  const num = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return String(val);
  const sym = currency === 'TL' ? '₺ ' : currency === 'EUR' ? '€ ' : '$ ';
  return sym + num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Ana Motor Tablosu Bileşeni (Sade, Açılırsız / Statik Tablo)
 */
export default function ProposalMotorTable({
  proposal,
  currency,
  formatUSD: customFormatPrice
}) {
  if (!proposal) return null;

  const motorList = getProposalMotors(proposal);
  const totalMotorCount = motorList.reduce((sum, item) => sum + item.qty, 0);
  const resolvedCurrency = currency || proposal.currency || proposal.payload?.currency || 'USD';
  const formatPrice = customFormatPrice || defaultFormatPrice;

  const calculatedSubtotal = proposal.subtotal !== undefined && proposal.subtotal !== null && !isNaN(parseFloat(proposal.subtotal))
    ? parseFloat(proposal.subtotal)
    : proposal.payload?.subtotal !== undefined && proposal.payload?.subtotal !== null && !isNaN(parseFloat(proposal.payload.subtotal))
      ? parseFloat(proposal.payload.subtotal)
      : motorList.reduce((sum, item) => {
          const num = parseFloat(String(item.price || 0).replace(/[^0-9.-]+/g, '')) || 0;
          return sum + num * (item.qty || 1);
        }, 0);

  const kdvRate = proposal.kdvRate !== undefined && proposal.kdvRate !== null && !isNaN(parseFloat(proposal.kdvRate))
    ? parseFloat(proposal.kdvRate)
    : proposal.payload?.kdvRate !== undefined && proposal.payload?.kdvRate !== null && !isNaN(parseFloat(proposal.payload.kdvRate))
      ? parseFloat(proposal.payload.kdvRate)
      : 20;

  const calculatedVat = proposal.vat !== undefined && proposal.vat !== null && !isNaN(parseFloat(proposal.vat))
    ? parseFloat(proposal.vat)
    : proposal.payload?.vat !== undefined && proposal.payload?.vat !== null && !isNaN(parseFloat(proposal.payload.vat))
      ? parseFloat(proposal.payload.vat)
      : (proposal.grandTotal !== undefined && proposal.grandTotal !== null && !isNaN(parseFloat(proposal.grandTotal)) && parseFloat(proposal.grandTotal) > calculatedSubtotal)
        ? (parseFloat(proposal.grandTotal) - calculatedSubtotal)
        : (proposal.payload?.grandTotal !== undefined && proposal.payload?.grandTotal !== null && !isNaN(parseFloat(proposal.payload.grandTotal)) && parseFloat(proposal.payload.grandTotal) > calculatedSubtotal)
          ? (parseFloat(proposal.payload.grandTotal) - calculatedSubtotal)
          : calculatedSubtotal * (kdvRate / 100.0);

  const kdvRateDisplay = kdvRate % 1 === 0 ? Math.round(kdvRate) : kdvRate;

  return (
    <View style={styles.container}>
      {/* Üst Başlık ve Toplam Adet Rozeti */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Motor Listesi</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalBadgeText}>Toplam {totalMotorCount} Adet</Text>
        </View>
      </View>

      {/* Tablo Çerçevesi */}
      <View style={styles.tableCard}>
        {/* Tablo Sütun Başlıkları */}
        <View style={styles.tableHeaderRow}>
          <View style={styles.colModelHeader}>
            <Text style={styles.tableHeaderText}>ADI</Text>
          </View>
          <View style={styles.colQtyHeader}>
            <Text style={styles.tableHeaderText}>MİKTAR</Text>
          </View>
          <View style={styles.colPriceHeader}>
            <Text style={styles.tableHeaderText}>FİYATI</Text>
          </View>
        </View>

        {/* Tablo Satırları */}
        <View style={styles.tableBody}>
          {motorList.map((item, index) => {
            const priceDisplay = item.price ? formatPrice(item.price, resolvedCurrency) : '-';
            const isEven = index % 2 === 1;

            return (
              <View
                key={item.id || index}
                style={[
                  styles.tableRow,
                  isEven && styles.tableRowEven,
                  index === motorList.length - 1 && styles.tableRowLast
                ]}
              >
                {/* 1. Sütun: Motor Adı */}
                <View style={styles.colModel}>
                  <Text style={styles.modelNameText} numberOfLines={1}>
                    {item.model}
                  </Text>
                </View>

                {/* 2. Sütun: Miktar (Kutusuz, Net Siyah Yazı) */}
                <View style={styles.colQty}>
                  <Text style={styles.qtyText}>{item.qty} Adet</Text>
                </View>

                {/* 3. Sütun: Fiyat */}
                <View style={styles.colPrice}>
                  <Text style={styles.priceText} numberOfLines={1}>
                    {priceDisplay}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Tablo Sağ Alt Toplamlar (KDV Hariç ve KDV Tutarı) */}
      <View style={styles.tableFooterContainer}>
        <View style={styles.tableFooterRow}>
          <Text style={styles.subtotalLabelText}>KDV Hariç Toplam: </Text>
          <Text style={styles.subtotalValueText}>{formatPrice(calculatedSubtotal, resolvedCurrency)}</Text>
        </View>
        <View style={[styles.tableFooterRow, styles.vatFooterRow]}>
          <Text style={styles.vatLabelText}>KDV (%{kdvRateDisplay}): </Text>
          <Text style={styles.vatValueText}>{formatPrice(calculatedVat, resolvedCurrency)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 0,
    marginBottom: 0
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sectionTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#6b7280',
    letterSpacing: 0.4,
    textTransform: 'uppercase'
  },
  totalBadge: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4
  },
  totalBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 10,
    color: '#374151'
  },
  tableCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden'
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 7,
    paddingHorizontal: 10
  },
  colModelHeader: {
    flex: 1.4
  },
  colQtyHeader: {
    flex: 0.8,
    alignItems: 'center'
  },
  colPriceHeader: {
    flex: 1.1,
    alignItems: 'flex-end'
  },
  tableHeaderText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 10,
    color: '#6b7280',
    letterSpacing: 0.5
  },
  tableBody: {
    backgroundColor: '#ffffff'
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  tableRowEven: {
    backgroundColor: '#f9fafb'
  },
  tableRowLast: {
    borderBottomWidth: 0
  },
  colModel: {
    flex: 1.4,
    justifyContent: 'center'
  },
  modelNameText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#1f2937'
  },
  colQty: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  qtyText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11.5,
    color: '#374151'
  },
  colPrice: {
    flex: 1.1,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },
  priceText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41'
  },
  tableFooterContainer: {
    marginTop: 8,
    paddingRight: 2,
    alignItems: 'flex-end'
  },
  tableFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end'
  },
  vatFooterRow: {
    marginTop: 4
  },
  subtotalLabelText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#64748b'
  },
  subtotalValueText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#1e293b'
  },
  vatLabelText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#64748b'
  },
  vatValueText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#1e293b'
  }
});
