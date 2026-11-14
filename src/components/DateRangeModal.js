import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MS } from '../constants/theme';
import DateRangeCalendar, { getDaysDifference, formatTurkishDate } from './DateRangeCalendar';

export default function DateRangeModal({
  visible,
  onClose,
  startDate,
  endDate,
  onApply,
  onClear
}) {
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  // Modal her açıldığında dışarıdan gelen tarihleri eşitle
  useEffect(() => {
    if (visible) {
      setTempStartDate(startDate);
      setTempEndDate(endDate);
    }
  }, [visible, startDate, endDate]);

  const handleApply = () => {
    onApply({
      startDate: tempStartDate,
      endDate: tempEndDate
    });
    onClose();
  };

  const handleClear = () => {
    setTempStartDate(null);
    setTempEndDate(null);
    if (onClear) onClear();
  };

  const daysCount = tempStartDate && tempEndDate
    ? getDaysDifference(tempStartDate, tempEndDate)
    : tempStartDate ? 1 : 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={styles.modalCard}
          onPress={(e) => e.stopPropagation && e.stopPropagation()}
        >
          {/* 1. Modal Başlığı */}
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="calendar" size={16} color="#107c41" />
              </View>
              <View>
                <Text style={styles.modalTitle}>Tarih Aralığı Seç</Text>
                <Text style={styles.modalSubtitle}>
                  {tempStartDate && tempEndDate
                    ? `${formatTurkishDate(tempStartDate)} — ${formatTurkishDate(tempEndDate)} (${daysCount} Gün)`
                    : tempStartDate
                      ? `${formatTurkishDate(tempStartDate)} (Bitiş seçin)`
                      : 'Başlangıç ve bitiş tarihini belirleyin'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.btnClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={19} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* 2. Takvim Gövdesi */}
          <ScrollView
            style={styles.modalBodyScroll}
            contentContainerStyle={styles.modalBodyContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <DateRangeCalendar
              startDate={tempStartDate}
              endDate={tempEndDate}
              onChangeRange={({ startDate: s, endDate: e }) => {
                setTempStartDate(s);
                setTempEndDate(e);
              }}
              onClear={handleClear}
            />
          </ScrollView>

          {/* 3. Modal Alt Butonları */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.btnReset}
              onPress={handleClear}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={15} color="#475569" style={{ marginRight: 5 }} />
              <Text style={styles.btnResetText}>Temizle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.btnApply,
                (!tempStartDate && !tempEndDate) && styles.btnApplyDisabled
              ]}
              onPress={handleApply}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.btnApplyText}>
                {daysCount > 0 ? `Uygula (${daysCount} Gün)` : 'Uygula'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '90%',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 24
      },
      android: {
        elevation: 32
      }
    })
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  iconCircle: {
    width: 32,
    height: 32,
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#0f172a'
  },
  modalSubtitle: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  btnClose: {
    padding: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0
  },
  modalBodyScroll: {
    flexGrow: 0
  },
  modalBodyContent: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 10
  },
  btnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0
  },
  btnResetText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#475569'
  },
  btnApply: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: '#107c41',
    borderRadius: 0
  },
  btnApplyDisabled: {
    backgroundColor: '#94a3b8'
  },
  btnApplyText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13.5,
    color: '#ffffff'
  }
});
