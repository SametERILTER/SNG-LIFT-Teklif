import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MS } from '../constants/theme';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const WEEKDAY_NAMES_TR = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

/**
 * Date nesnesini 'YYYY-MM-DD' formatına çevirir
 */
export function formatISODate(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * 'YYYY-MM-DD' veya Date nesnesini 'DD.MM.YYYY' Türkçe formatına çevirir
 */
export function formatTurkishDate(dateOrStr) {
  if (!dateOrStr) return '';
  if (typeof dateOrStr === 'string' && dateOrStr.includes('.')) {
    return dateOrStr;
  }
  if (typeof dateOrStr === 'string' && dateOrStr.includes('-')) {
    const parts = dateOrStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
  }
  const d = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * İki ISO tarih ('YYYY-MM-DD') arasındaki gün sayısını hesaplar (dahil)
 */
export function getDaysDifference(startISO, endISO) {
  if (!startISO || !endISO) return 0;
  const d1 = new Date(startISO + 'T00:00:00');
  const d2 = new Date(endISO + 'T00:00:00');
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

export default function DateRangeCalendar({
  startDate, // 'YYYY-MM-DD' veya null
  endDate,   // 'YYYY-MM-DD' veya null
  onChangeRange, // ({ startDate, endDate }) => void
  onClear        // () => void
}) {
  // Görüntülenen ay ve yıl state'i (Başlangıç tarihi varsa o aya gider, yoksa bugüne)
  const initialDate = useMemo(() => {
    if (startDate) {
      const d = new Date(startDate + 'T00:00:00');
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  }, [startDate]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-11

  // Bugünün ISO tarihi
  const todayISO = useMemo(() => formatISODate(new Date()), []);

  // Önceki aya git
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  // Sonraki aya git
  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Bugünün ayına git
  const handleJumpToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  // Takvim hücresine basıldığında aralık seçimi
  const handleDayPress = (dayISO) => {
    if (!dayISO) return;

    if (!startDate || (startDate && endDate)) {
      // 1. Dokunuş: Başlangıç tarihi ayarlanır
      onChangeRange({ startDate: dayISO, endDate: null });
    } else if (startDate && !endDate) {
      // 2. Dokunuş: Bitiş tarihi ayarlanır
      if (dayISO < startDate) {
        // Tıklanan tarih başlangıçtan eskiyse yeni başlangıç yap
        onChangeRange({ startDate: dayISO, endDate: null });
      } else {
        onChangeRange({ startDate, endDate: dayISO });
      }
    }
  };

  // Hızlı Hazır Aralık Butonları (Presets)
  const handleApplyPreset = (presetKey) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let s = null;
    let e = null;

    if (presetKey === 'TODAY') {
      s = formatISODate(today);
      e = formatISODate(today);
    } else if (presetKey === 'YESTERDAY') {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      s = formatISODate(y);
      e = formatISODate(y);
    } else if (presetKey === 'LAST_7_DAYS') {
      const past7 = new Date(today);
      past7.setDate(past7.getDate() - 6);
      s = formatISODate(past7);
      e = formatISODate(today);
    } else if (presetKey === 'LAST_30_DAYS') {
      const past30 = new Date(today);
      past30.setDate(past30.getDate() - 29);
      s = formatISODate(past30);
      e = formatISODate(today);
    } else if (presetKey === 'THIS_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      s = formatISODate(firstDay);
      e = formatISODate(lastDay);
    } else if (presetKey === 'LAST_MONTH') {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      s = formatISODate(firstDay);
      e = formatISODate(lastDay);
    } else if (presetKey === 'THIS_YEAR') {
      const firstDay = new Date(today.getFullYear(), 0, 1);
      const lastDay = new Date(today.getFullYear(), 11, 31);
      s = formatISODate(firstDay);
      e = formatISODate(lastDay);
    }

    if (s && e) {
      const targetDate = new Date(s + 'T00:00:00');
      setViewYear(targetDate.getFullYear());
      setViewMonth(targetDate.getMonth());
      onChangeRange({ startDate: s, endDate: e });
    }
  };

  // Takvim günleri ızgarasını (Grid) oluştur
  const calendarGrid = useMemo(() => {
    // Ayın ilk günü ve haftanın günü (Pazartesi=0 olması için normalize et)
    const firstDayDate = new Date(viewYear, viewMonth, 1);
    const dayOfWeek = (firstDayDate.getDay() + 6) % 7; // 0: Pzt, 6: Paz

    // Ayın toplam gün sayısı
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Önceki ayın toplam gün sayısı
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const weeks = [];
    let currentWeek = [];

    // 1. Önceki aydan gelen sol boşluk günleri
    for (let i = dayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthDate = new Date(viewYear, viewMonth - 1, dayNum);
      const iso = formatISODate(prevMonthDate);
      currentWeek.push({
        dayNum,
        iso,
        isCurrentMonth: false
      });
    }

    // 2. Bu ayın günleri
    for (let day = 1; day <= daysInCurrentMonth; day++) {
      const curDate = new Date(viewYear, viewMonth, day);
      const iso = formatISODate(curDate);
      currentWeek.push({
        dayNum: day,
        iso,
        isCurrentMonth: true
      });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 3. Sonraki aydan gelen sağ boşluk günleri (7'ye tamamla)
    if (currentWeek.length > 0) {
      let nextMonthDay = 1;
      while (currentWeek.length < 7) {
        const nextMonthDate = new Date(viewYear, viewMonth + 1, nextMonthDay);
        const iso = formatISODate(nextMonthDate);
        currentWeek.push({
          dayNum: nextMonthDay,
          iso,
          isCurrentMonth: false
        });
        nextMonthDay++;
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [viewYear, viewMonth]);

  const daysCount = useMemo(() => {
    if (startDate && endDate) {
      return getDaysDifference(startDate, endDate);
    }
    if (startDate) return 1;
    return 0;
  }, [startDate, endDate]);

  return (
    <View style={styles.calendarContainer}>
      {/* 1. HIZLI ÖN AYAR BUTONLARI (KAYDIRILABİLİR) */}
      <View style={styles.presetsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsScrollContent}
        >
          {[
            { id: 'TODAY', label: 'Bugün' },
            { id: 'YESTERDAY', label: 'Dün' },
            { id: 'LAST_7_DAYS', label: 'Son 7 Gün' },
            { id: 'THIS_MONTH', label: 'Bu Ay' },
            { id: 'LAST_MONTH', label: 'Geçen Ay' },
            { id: 'LAST_30_DAYS', label: 'Son 30 Gün' },
            { id: 'THIS_YEAR', label: 'Bu Yıl' }
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.presetChip}
              onPress={() => handleApplyPreset(item.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 2. TAKVİM BAŞLIĞI (AY/YIL GEZİNTİSİ) */}
      <View style={styles.monthHeaderRow}>
        <TouchableOpacity
          style={styles.navMonthBtn}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={18} color="#334155" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.monthYearTitleBox}
          onPress={handleJumpToToday}
          activeOpacity={0.8}
        >
          <Text style={styles.monthYearText}>
            {`${MONTH_NAMES_TR[viewMonth]} ${viewYear}`}
          </Text>
          <View style={styles.todayIndicatorBadge}>
            <Text style={styles.todayIndicatorBadgeText}>Bugün</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navMonthBtn}
          onPress={handleNextMonth}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-forward" size={18} color="#334155" />
        </TouchableOpacity>
      </View>

      {/* 3. HAFTANIN GÜNLERİ BAŞLIKLARI */}
      <View style={styles.weekdaysRow}>
        {WEEKDAY_NAMES_TR.map((dayName, idx) => (
          <View key={idx} style={styles.weekdayCell}>
            <Text
              style={[
                styles.weekdayText,
                (idx === 5 || idx === 6) && styles.weekdayWeekendText
              ]}
            >
              {dayName}
            </Text>
          </View>
        ))}
      </View>

      {/* 4. TAKVİM GÜN IZGARASI (GRID) */}
      <View style={styles.gridContainer}>
        {calendarGrid.map((week, wIdx) => (
          <View key={wIdx} style={styles.weekRow}>
            {week.map((cell, cIdx) => {
              const { dayNum, iso, isCurrentMonth } = cell;

              const isStart = startDate === iso;
              const isEnd = endDate === iso;
              const isSingleSelected = isStart && (!endDate || startDate === endDate);
              const isInRange =
                startDate &&
                endDate &&
                iso > startDate &&
                iso < endDate;

              const isToday = iso === todayISO;

              return (
                <View key={cIdx} style={styles.dayCellContainer}>
                  {/* Aralık Bağlantı Arka Planı (Şerit) */}
                  {isInRange && <View style={styles.inRangeBand} />}
                  {isStart && endDate && startDate !== endDate && (
                    <View style={styles.startRangeBandRight} />
                  )}
                  {isEnd && startDate && startDate !== endDate && (
                    <View style={styles.endRangeBandLeft} />
                  )}

                  <TouchableOpacity
                    style={[
                      styles.dayButton,
                      isStart && styles.dayButtonStart,
                      isEnd && styles.dayButtonEnd,
                      isSingleSelected && styles.dayButtonSingle,
                      isInRange && styles.dayButtonInRange,
                      !isCurrentMonth && styles.dayButtonOtherMonth,
                      isToday && !isStart && !isEnd && !isInRange && styles.dayButtonToday
                    ]}
                    onPress={() => handleDayPress(iso)}
                    activeOpacity={0.65}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !isCurrentMonth && styles.dayTextOtherMonth,
                        (isStart || isEnd) && styles.dayTextSelected,
                        isInRange && styles.dayTextInRange,
                        isToday && !isStart && !isEnd && styles.dayTextToday
                      ]}
                    >
                      {dayNum}
                    </Text>

                    {/* Bugün Noktası */}
                    {isToday && !isStart && !isEnd && (
                      <View style={styles.todayDot} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* 5. SEÇİLEN TARİH ARALIĞI ÖZET KARTI */}
      <View style={styles.selectionSummaryCard}>
        <View style={styles.summaryInfoBox}>
          <View style={styles.summaryDateRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>BAŞLANGIÇ</Text>
              <Text style={styles.summaryValue}>
                {startDate ? formatTurkishDate(startDate) : 'Seçilmedi'}
              </Text>
            </View>

            <View style={styles.summaryArrow}>
              <Ionicons name="arrow-forward" size={14} color="#94a3b8" />
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>BİTİŞ</Text>
              <Text style={styles.summaryValue}>
                {endDate ? formatTurkishDate(endDate) : (startDate ? 'Bitiş seçin...' : 'Seçilmedi')}
              </Text>
            </View>
          </View>

          {daysCount > 0 && (
            <View style={styles.daysBadge}>
              <Ionicons name="calendar-outline" size={12} color="#107c41" style={{ marginRight: 4 }} />
              <Text style={styles.daysBadgeText}>{daysCount} Gün</Text>
            </View>
          )}
        </View>

        {(startDate || endDate) && (
          <TouchableOpacity
            style={styles.btnClearRange}
            onPress={onClear}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={14} color="#e11d48" style={{ marginRight: 4 }} />
            <Text style={styles.btnClearRangeText}>Temizle</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    marginTop: 8
  },
  presetsWrapper: {
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 8
  },
  presetsScrollContent: {
    paddingHorizontal: 10,
    gap: 6
  },
  presetChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 0
  },
  presetChipText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11,
    color: '#334155'
  },
  monthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff'
  },
  navMonthBtn: {
    padding: 6,
    borderRadius: 0,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  monthYearTitleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  monthYearText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14,
    color: '#0f172a'
  },
  todayIndicatorBadge: {
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0
  },
  todayIndicatorBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 9.5,
    color: '#107c41'
  },
  weekdaysRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    paddingVertical: 6
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  weekdayText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#64748b'
  },
  weekdayWeekendText: {
    color: '#94a3b8'
  },
  gridContainer: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    backgroundColor: '#ffffff'
  },
  weekRow: {
    flexDirection: 'row',
    marginVertical: 2
  },
  dayCellContainer: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  inRangeBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 2,
    bottom: 2,
    backgroundColor: '#eef8f1'
  },
  startRangeBandRight: {
    position: 'absolute',
    left: '50%',
    right: 0,
    top: 2,
    bottom: 2,
    backgroundColor: '#eef8f1'
  },
  endRangeBandLeft: {
    position: 'absolute',
    left: 0,
    right: '50%',
    top: 2,
    bottom: 2,
    backgroundColor: '#eef8f1'
  },
  dayButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    zIndex: 2
  },
  dayButtonStart: {
    backgroundColor: '#107c41'
  },
  dayButtonEnd: {
    backgroundColor: '#107c41'
  },
  dayButtonSingle: {
    backgroundColor: '#107c41'
  },
  dayButtonInRange: {
    backgroundColor: 'transparent'
  },
  dayButtonOtherMonth: {
    opacity: 0.35
  },
  dayButtonToday: {
    borderWidth: 1,
    borderColor: '#107c41',
    backgroundColor: '#f0fdf4'
  },
  dayText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12.5,
    color: '#1e293b'
  },
  dayTextOtherMonth: {
    color: '#94a3b8'
  },
  dayTextSelected: {
    fontFamily: MS.fontFamilyBold,
    color: '#ffffff'
  },
  dayTextInRange: {
    fontFamily: MS.fontFamilySemiBold,
    color: '#107c41'
  },
  dayTextToday: {
    fontFamily: MS.fontFamilyBold,
    color: '#107c41'
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#107c41',
    position: 'absolute',
    bottom: 3
  },
  selectionSummaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  summaryInfoBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8
  },
  summaryDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  summaryItem: {
    flexDirection: 'column'
  },
  summaryLabel: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 9,
    color: '#64748b',
    letterSpacing: 0.3
  },
  summaryValue: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11.5,
    color: '#0f172a'
  },
  summaryArrow: {
    paddingHorizontal: 2
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 0,
    marginLeft: 4
  },
  daysBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 10,
    color: '#107c41'
  },
  btnClearRange: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 0,
    marginLeft: 8
  },
  btnClearRangeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#e11d48'
  }
});
