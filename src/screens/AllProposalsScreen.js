import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  Platform,
  Pressable,
  SectionList,
  BackHandler
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  Keyframe,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS, STORAGE_KEY } from '../constants/theme';
import { exportAndSharePDF } from '../utils/pdfGenerator';
import { useScreenTransition } from '../utils/useScreenTransition';
import ProposalPreviewModal from '../components/ProposalPreviewModal';
import ProposalActionModal from '../components/ProposalActionModal';
import ProposalCardItem from '../components/ProposalCardItem';
import ProposalMotorTable from '../components/ProposalMotorTable';
import DateRangeModal from '../components/DateRangeModal';
import { formatTurkishDate } from '../components/DateRangeCalendar';
import { getSmartDateLabel, parseProposalDate } from '../utils/dateUtils';
import { getProposalMotors } from '../utils/proposalUtils';

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList);

const STATUSBAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
const COLLAPSE_AMOUNT = 46;
const HEADER_HEIGHT = STATUSBAR_H + 98;
const SCROLL_DISTANCE = 110;

// Silme animasyonu: Önce ease ile hafif büyür (scale 1.0 -> 1.08), ardından yumuşakça solarak kaybolur
const deleteCardExiting = new Keyframe({
  0: {
    transform: [{ scale: 1 }],
    opacity: 1
  },
  40: {
    transform: [{ scale: 1.08 }],
    opacity: 1,
    easing: Easing.out(Easing.cubic)
  },
  100: {
    transform: [{ scale: 1.08 }],
    opacity: 0,
    easing: Easing.out(Easing.quad)
  }
}).duration(500);

const formatUSD = (val, currency = 'USD') => {
  if (val === null || val === undefined || isNaN(val)) return `0,00 ${currency}`;
  const sym = currency === 'TL' ? '₺ ' : currency === 'EUR' ? '€ ' : '$ ';
  return sym + Number(val).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Arama ve Filtreleme Başlık Bileşeni (Ayrı bir component olarak tanımlanması klavyenin anlık kapanmasını engeller)
const ProposalListHeader = React.memo(({
  searchQuery,
  setSearchQuery,
  activeFilterCount,
  filterCurrency,
  setFilterCurrency,
  filterMinPrice,
  setFilterMinPrice,
  filterMaxPrice,
  setFilterMaxPrice,
  filterPeriod,
  setFilterPeriod,
  filterStartDate,
  setFilterStartDate,
  filterEndDate,
  setFilterEndDate,
  filterSort,
  setFilterSort,
  handleResetAllFilters
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.listHeaderWrapper}>
      {/* --- ARAMA ÇUBUĞU --- */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
          <Ionicons
            name="search-outline"
            size={18}
            color={isFocused ? MS.success : MS.textMuted}
            style={{ marginRight: 8 }}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Firma, yetkili veya tarihe göre ara..."
            placeholderTextColor={MS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={MS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- AKTİF FİLTRELER ÇUBUĞU (Eğer filtre seçildiyse göster) --- */}
      {activeFilterCount > 0 && (
        <View style={styles.activeFiltersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersScroll}>
            <View style={styles.activeFilterCountTag}>
              <Ionicons name="funnel" size={11} color={MS.primary} style={{ marginRight: 4 }} />
              <Text style={styles.activeFilterCountTagText}>{activeFilterCount} Filtre Aktif</Text>
            </View>

            {filterCurrency !== 'ALL' && (
              <TouchableOpacity style={styles.filterChip} onPress={() => setFilterCurrency('ALL')} activeOpacity={0.7}>
                <Text style={styles.filterChipText} numberOfLines={1}>Birim: {filterCurrency}</Text>
                <Ionicons name="close" size={13} color="#64748b" style={{ marginLeft: 6, flexShrink: 0 }} />
              </TouchableOpacity>
            )}

            {(filterMinPrice.trim() !== '' || filterMaxPrice.trim() !== '') && (
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => {
                  setFilterMinPrice('');
                  setFilterMaxPrice('');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.filterChipText} numberOfLines={1}>
                  Fiyat: {filterMinPrice ? `${filterMinPrice}` : '0'} - {filterMaxPrice ? `${filterMaxPrice}` : '∞'}
                </Text>
                <Ionicons name="close" size={13} color="#64748b" style={{ marginLeft: 6, flexShrink: 0 }} />
              </TouchableOpacity>
            )}

            {filterPeriod !== 'ALL' && (
              <TouchableOpacity
                style={styles.filterChip}
                onPress={() => {
                  setFilterPeriod('ALL');
                  setFilterStartDate(null);
                  setFilterEndDate(null);
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={filterPeriod === 'CUSTOM' ? 'calendar' : 'time-outline'}
                  size={12}
                  color="#107c41"
                  style={{ marginRight: 5, flexShrink: 0 }}
                />
                <Text style={styles.filterChipText} numberOfLines={1}>
                  {filterPeriod === 'CUSTOM'
                    ? filterStartDate && filterEndDate
                      ? `${formatTurkishDate(filterStartDate)} - ${formatTurkishDate(filterEndDate)}`
                      : filterStartDate
                        ? `>= ${formatTurkishDate(filterStartDate)}`
                        : filterEndDate
                          ? `<= ${formatTurkishDate(filterEndDate)}`
                          : 'Özel Tarih'
                    : filterPeriod === 'TODAY'
                      ? 'Bugün'
                      : filterPeriod === 'WEEK'
                        ? 'Bu Hafta'
                        : filterPeriod === 'MONTH'
                          ? 'Bu Ay'
                          : 'Bu Yıl'}
                </Text>
                <Ionicons name="close" size={13} color="#64748b" style={{ marginLeft: 6, flexShrink: 0 }} />
              </TouchableOpacity>
            )}

            {filterSort !== 'DATE_DESC' && (
              <TouchableOpacity style={styles.filterChip} onPress={() => setFilterSort('DATE_DESC')} activeOpacity={0.7}>
                <Text style={styles.filterChipText} numberOfLines={1}>
                  {filterSort === 'DATE_ASC'
                    ? 'En Eski'
                    : filterSort === 'PRICE_DESC'
                      ? 'Fiyat: Azalan'
                      : filterSort === 'PRICE_ASC'
                        ? 'Fiyat: Artan'
                        : 'Firma: A-Z'}
                </Text>
                <Ionicons name="close" size={13} color="#64748b" style={{ marginLeft: 6, flexShrink: 0 }} />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Alt Kısım: Tümünü Temizle Butonu */}
          <View style={styles.clearAllBottomRow}>
            <TouchableOpacity style={styles.filterClearAllChip} onPress={handleResetAllFilters} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={12} color="#e11d48" style={{ marginRight: 4 }} />
              <Text style={styles.filterClearAllText}>Tümünü Temizle</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
});

export default function AllProposalsScreen({ navigation }) {
  const { animatedStyle, handleGoBack } = useScreenTransition(navigation);
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Ana Sayfa (Geri) butonu basma animasyonu (Yaylanmasız, pürüzsüz)
  const backScale = useSharedValue(1);
  const backOpacity = useSharedValue(1);
  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
    opacity: backOpacity.value
  }));
  const handleBackPressIn = () => {
    backScale.value = withTiming(0.94, { duration: 110, easing: Easing.out(Easing.quad) });
    backOpacity.value = withTiming(0.85, { duration: 110, easing: Easing.out(Easing.quad) });
  };
  const handleBackPressOut = () => {
    backScale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    backOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  };

  // Filtre butonu basma animasyonu (Yaylanmasız, pürüzsüz)
  const filterScale = useSharedValue(1);
  const filterOpacity = useSharedValue(1);
  const filterAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: filterScale.value }],
    opacity: filterOpacity.value
  }));
  const handleFilterPressIn = () => {
    filterScale.value = withTiming(0.94, { duration: 110, easing: Easing.out(Easing.quad) });
    filterOpacity.value = withTiming(0.85, { duration: 110, easing: Easing.out(Easing.quad) });
  };
  const handleFilterPressOut = () => {
    filterScale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    filterOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  };

  // Teklif Oluştur (FAB) butonu basma animasyonu
  const fabScale = useSharedValue(1);
  const fabOpacity = useSharedValue(1);
  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
    opacity: fabOpacity.value
  }));
  const handleFabPressIn = () => {
    fabScale.value = withTiming(0.96, { duration: 110, easing: Easing.out(Easing.quad) });
    fabOpacity.value = withTiming(0.9, { duration: 110, easing: Easing.out(Easing.quad) });
  };
  const handleFabPressOut = () => {
    fabScale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    fabOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  };

  // --- SCROLL KAYDIRMAYA BAĞLI DİNAMİK HEADER ANİMASYONLARI (100% GPU TRANSFORM - 0 LAYOUT PASS) ---
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  // 1. Header'ı yukarı kaydırarak alttan kısaltma (GPU Transform)
  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -COLLAPSE_AMOUNT],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }]
    };
  });

  // 2. Üst navigasyon çubuğunu ekranda sabit tutma (GPU Transform)
  const navRowAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, COLLAPSE_AMOUNT],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }]
    };
  });

  // 3. Büyük başlığın süzülerek kaybolması
  const titleRowAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 65],
      [1, 0],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, SCROLL_DISTANCE],
      [0, -10],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }]
    };
  });

  // 4. "Ana Sayfa" / "Vazgeç" yazısının pürüzsüzce kaybolması (GPU Opacity)
  const backTextAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 48],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity
    };
  });

  // 5. Küçük başlığın yumuşakça belirmesi (GPU Opacity & Transform)
  const smallTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [48, 95],
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [48, 95],
      [4, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }]
    };
  });

  // Filtreleme State'leri (Uygulanan)
  const [filterCurrency, setFilterCurrency] = useState('ALL'); // 'ALL', 'USD', 'TL', 'EUR'
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('ALL'); // 'ALL', 'TODAY', 'WEEK', 'MONTH', 'YEAR', 'CUSTOM'
  const [filterStartDate, setFilterStartDate] = useState(null); // 'YYYY-MM-DD'
  const [filterEndDate, setFilterEndDate] = useState(null); // 'YYYY-MM-DD'
  const [filterSort, setFilterSort] = useState('DATE_DESC'); // 'DATE_DESC', 'DATE_ASC', 'PRICE_DESC', 'PRICE_ASC', 'NAME_ASC'

  // Filtre Modalı ve Taslak (Draft) State'leri
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [draftCurrency, setDraftCurrency] = useState('ALL');
  const [draftMinPrice, setDraftMinPrice] = useState('');
  const [draftMaxPrice, setDraftMaxPrice] = useState('');
  const [draftPeriod, setDraftPeriod] = useState('ALL');
  const [draftStartDate, setDraftStartDate] = useState(null);
  const [draftEndDate, setDraftEndDate] = useState(null);
  const [draftSort, setDraftSort] = useState('DATE_DESC');

  // Özel Teklif Aksiyon Modalı
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [cardOrigin, setCardOrigin] = useState(null);

  // Silinen teklifi geri alma (Snackbar) durumu
  const [deletedProposalInfo, setDeletedProposalInfo] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const snackbarTimerRef = useRef(null);

  // Çoklu Seçim Modu State'leri
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Android donanım geri tuşuna basıldığında seçim modundan çık
  useEffect(() => {
    if (!isSelectionMode) return;
    const onBackPress = () => {
      setIsSelectionMode(false);
      setSelectedIds(new Set());
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [isSelectionMode]);

  // Uygulama içi önizleme modalı
  const [previewVisible, setPreviewVisible] = useState(false);
  const [activeProposalRecord, setActiveProposalRecord] = useState(null);

  // Kayıtlı teklifleri oku
  const loadProposals = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProposals(JSON.parse(stored));
      } else {
        setProposals([]);
      }
    } catch (e) {
      console.log('Teklifler yüklenemedi:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadProposals();
    }, [])
  );

  // Aktif Filtre Sayısı
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterCurrency !== 'ALL') count++;
    if (filterMinPrice.trim() !== '') count++;
    if (filterMaxPrice.trim() !== '') count++;
    if (filterPeriod === 'CUSTOM') {
      if (filterStartDate || filterEndDate) count++;
    } else if (filterPeriod !== 'ALL') {
      count++;
    }
    if (filterSort !== 'DATE_DESC') count++;
    return count;
  }, [filterCurrency, filterMinPrice, filterMaxPrice, filterPeriod, filterStartDate, filterEndDate, filterSort]);

  // Filtre Modalını Aç
  const handleOpenFilterModal = () => {
    setDraftCurrency(filterCurrency);
    setDraftMinPrice(filterMinPrice);
    setDraftMaxPrice(filterMaxPrice);
    setDraftPeriod(filterPeriod);
    setDraftStartDate(filterStartDate);
    setDraftEndDate(filterEndDate);
    setDraftSort(filterSort);
    setFilterModalVisible(true);
  };

  // Filtreleri Uygula
  const handleApplyFilters = () => {
    setFilterCurrency(draftCurrency);
    setFilterMinPrice(draftMinPrice);
    setFilterMaxPrice(draftMaxPrice);
    setFilterPeriod(draftPeriod);
    setFilterStartDate(draftStartDate);
    setFilterEndDate(draftEndDate);
    setFilterSort(draftSort);
    setFilterModalVisible(false);
  };

  // Modal içindeki taslak filtreleri sıfırla
  const handleResetDraftFilters = () => {
    setDraftCurrency('ALL');
    setDraftMinPrice('');
    setDraftMaxPrice('');
    setDraftPeriod('ALL');
    setDraftStartDate(null);
    setDraftEndDate(null);
    setDraftSort('DATE_DESC');
  };

  // Tüm filtreleri tamamen sıfırla
  const handleResetAllFilters = () => {
    setFilterCurrency('ALL');
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterPeriod('ALL');
    setFilterStartDate(null);
    setFilterEndDate(null);
    setFilterSort('DATE_DESC');
  };

  // Tarih filtresi eşleşme kontrolü fonksiyonu
  const checkDateFilter = useCallback((p, period, startDateISO, endDateISO) => {
    if (period === 'ALL') return true;

    const pDate = parseProposalDate(p.tarih, p.id);
    const pYear = pDate.getFullYear();
    const pMonth = pDate.getMonth();
    const pDay = pDate.getDate();

    if (period === 'CUSTOM') {
      if (!startDateISO && !endDateISO) return true;
      const pDayTimestamp = new Date(pYear, pMonth, pDay, 12, 0, 0).getTime();

      if (startDateISO) {
        const partsS = startDateISO.split('-');
        const startTimestamp = new Date(parseInt(partsS[0], 10), parseInt(partsS[1], 10) - 1, parseInt(partsS[2], 10), 0, 0, 0).getTime();
        if (pDayTimestamp < startTimestamp) return false;
      }

      if (endDateISO) {
        const partsE = endDateISO.split('-');
        const endTimestamp = new Date(parseInt(partsE[0], 10), parseInt(partsE[1], 10) - 1, parseInt(partsE[2], 10), 23, 59, 59).getTime();
        if (pDayTimestamp > endTimestamp) return false;
      }

      return true;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(pYear, pMonth, pDay);
    const diffDays = Math.round((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

    if (period === 'TODAY') return diffDays === 0;
    if (period === 'WEEK') return diffDays >= 0 && diffDays <= 7;
    if (period === 'MONTH') return pMonth === now.getMonth() && pYear === now.getFullYear();
    if (period === 'YEAR') return pYear === now.getFullYear();

    return true;
  }, []);

  // Modal içinde canlı eşleşen sonuç sayısı
  const draftMatchCount = useMemo(() => {
    if (!filterModalVisible) return 0;
    return proposals.filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const firma = (p.firma || '').toLowerCase();
        const yetkili = (p.yetkili || '').toLowerCase();
        const tarih = (p.tarih || '').toLowerCase();
        const no = (p.teklifNo || '').toLowerCase();
        if (!firma.includes(q) && !yetkili.includes(q) && !tarih.includes(q) && !no.includes(q)) return false;
      }

      if (draftCurrency !== 'ALL') {
        const curr = p.currency || p.payload?.currency || 'USD';
        if (curr.toUpperCase() !== draftCurrency.toUpperCase()) return false;
      }

      const grandTotal = Number(p.grandTotal || p.payload?.grandTotal || 0);
      if (draftMinPrice.trim()) {
        const min = parseFloat(draftMinPrice.replace(',', '.'));
        if (!isNaN(min) && grandTotal < min) return false;
      }
      if (draftMaxPrice.trim()) {
        const max = parseFloat(draftMaxPrice.replace(',', '.'));
        if (!isNaN(max) && grandTotal > max) return false;
      }

      if (!checkDateFilter(p, draftPeriod, draftStartDate, draftEndDate)) {
        return false;
      }

      return true;
    }).length;
  }, [proposals, searchQuery, filterModalVisible, draftCurrency, draftMinPrice, draftMaxPrice, draftPeriod, draftStartDate, draftEndDate, checkDateFilter]);

  // Arama, Filtreleme ve Sıralama
  const filteredProposals = useMemo(() => {
    let list = [...proposals];

    // 1. Arama sorgusu
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((p) => {
        const firma = (p.firma || '').toLowerCase();
        const yetkili = (p.yetkili || '').toLowerCase();
        const tarih = (p.tarih || '').toLowerCase();
        const no = (p.teklifNo || '').toLowerCase();
        return firma.includes(q) || yetkili.includes(q) || tarih.includes(q) || no.includes(q);
      });
    }

    // 2. Para birimi filtresi
    if (filterCurrency !== 'ALL') {
      list = list.filter((p) => {
        const curr = p.currency || p.payload?.currency || 'USD';
        return curr.toUpperCase() === filterCurrency.toUpperCase();
      });
    }

    // 3. Fiyat aralığı filtresi
    if (filterMinPrice.trim()) {
      const min = parseFloat(filterMinPrice.replace(',', '.'));
      if (!isNaN(min)) {
        list = list.filter((p) => {
          const grandTotal = Number(p.grandTotal || p.payload?.grandTotal || 0);
          return grandTotal >= min;
        });
      }
    }
    if (filterMaxPrice.trim()) {
      const max = parseFloat(filterMaxPrice.replace(',', '.'));
      if (!isNaN(max)) {
        list = list.filter((p) => {
          const grandTotal = Number(p.grandTotal || p.payload?.grandTotal || 0);
          return grandTotal <= max;
        });
      }
    }

    // 4. Tarih / Dönem filtresi
    if (filterPeriod !== 'ALL') {
      list = list.filter((p) => checkDateFilter(p, filterPeriod, filterStartDate, filterEndDate));
    }

    // 5. Sıralama
    list.sort((a, b) => {
      const dateA = parseProposalDate(a.tarih, a.id).getTime();
      const dateB = parseProposalDate(b.tarih, b.id).getTime();
      const priceA = Number(a.grandTotal || a.payload?.grandTotal || 0);
      const priceB = Number(b.grandTotal || b.payload?.grandTotal || 0);
      const nameA = (a.firma || '').toLocaleLowerCase('tr');
      const nameB = (b.firma || '').toLocaleLowerCase('tr');

      if (filterSort === 'DATE_ASC') {
        return dateA - dateB;
      } else if (filterSort === 'PRICE_DESC') {
        return priceB - priceA;
      } else if (filterSort === 'PRICE_ASC') {
        return priceA - priceB;
      } else if (filterSort === 'NAME_ASC') {
        return nameA.localeCompare(nameB, 'tr');
      } else {
        // DATE_DESC (Varsayılan: En Yeni İlk)
        return dateB - dateA;
      }
    });

    return list;
  }, [proposals, searchQuery, filterCurrency, filterMinPrice, filterMaxPrice, filterPeriod, filterStartDate, filterEndDate, filterSort, checkDateFilter]);

  // Teklifleri sola dayalı akıllı tarihlere göre SectionList formatında gruplandır
  const sections = useMemo(() => {
    const groups = [];
    const map = new Map();
    let overallIndex = 0;

    filteredProposals.forEach((prop) => {
      const label = getSmartDateLabel(prop.tarih, prop.id);
      if (!map.has(label)) {
        const newGroup = {
          title: label,
          data: []
        };
        map.set(label, newGroup);
        groups.push(newGroup);
      }
      map.get(label).data.push({
        ...prop,
        _overallIndex: overallIndex++
      });
    });

    return groups;
  }, [filteredProposals]);

  // Uygulama içi önizlemeyi aç
  const handleOpenPreview = (record) => {
    setActiveProposalRecord(record);
    setPreviewVisible(true);
  };

  // Düzenleme yapıldığında teklifi güncelle
  const handleSaveUpdatedRecord = async (updatedRecord) => {
    try {
      setActiveProposalRecord(updatedRecord);
      setSelectedProposal(updatedRecord);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        const nextList = list.map(item => String(item.id) === String(updatedRecord.id) ? updatedRecord : item);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
        setProposals(nextList);
      }
    } catch (e) {
      console.log('Teklif kaydı güncellenemedi:', e);
    }
  };

  // Teklif Sil ve Geri Almayı Başlat
  const handleDeleteProposal = async (proposalToDelete) => {
    closeProposalModal();
    if (!proposalToDelete) return;

    const originalIndex = proposals.findIndex(p => p.id === proposalToDelete.id);
    const filtered = proposals.filter(p => p.id !== proposalToDelete.id);

    setProposals(filtered);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    setDeletedProposalInfo({
      item: proposalToDelete,
      index: originalIndex >= 0 ? originalIndex : 0
    });
    setSnackbarVisible(true);

    if (snackbarTimerRef.current) {
      clearTimeout(snackbarTimerRef.current);
    }
    snackbarTimerRef.current = setTimeout(() => {
      setSnackbarVisible(false);
    }, 4500);
  };

  // Silinen Teklifi Geri Al
  const handleUndoDelete = async () => {
    if (!deletedProposalInfo) return;
    if (snackbarTimerRef.current) {
      clearTimeout(snackbarTimerRef.current);
    }
    setSnackbarVisible(false);

    const { item, index } = deletedProposalInfo;
    const nextList = [...proposals];
    if (index >= 0 && index <= nextList.length) {
      nextList.splice(index, 0, item);
    } else {
      nextList.unshift(item);
    }

    setProposals(nextList);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    setDeletedProposalInfo(null);
  };

  // Aksiyon modalını aç/kapat
  const openProposalModal = useCallback((record, origin) => {
    setSelectedProposal(record);
    setCardOrigin(origin || null);
    setActionModalVisible(true);
  }, []);

  const closeProposalModal = useCallback(() => {
    setActionModalVisible(false);
  }, []);

  const handleShareProposal = (proposal) => {
    const target = proposal?.payload || proposal;
    closeProposalModal();
    setTimeout(() => {
      exportAndSharePDF(target);
    }, 350);
  };

  // Kart Basılı Tutma (Çoklu Seçim Modunu Başlat / Değiştir)
  const handleCardLongPress = useCallback((prop) => {
    if (!isSelectionMode) {
      setIsSelectionMode(true);
      setSelectedIds(new Set([prop.id]));
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(prop.id)) {
          next.delete(prop.id);
        } else {
          next.add(prop.id);
        }
        return next;
      });
    }
  }, [isSelectionMode]);

  // Kart Tıklama (Seçim Modundaysa Seç/Kaldır)
  const handleCardPress = useCallback((prop) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(prop.id)) {
        next.delete(prop.id);
      } else {
        next.add(prop.id);
      }
      return next;
    });
  }, []);

  // Seçim Modundan Çık
  const handleExitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Tümünü Seç / Temizle
  const isAllSelected = useMemo(() => {
    if (filteredProposals.length === 0) return false;
    return filteredProposals.every(p => selectedIds.has(p.id));
  }, [filteredProposals, selectedIds]);

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProposals.map(p => p.id)));
    }
  }, [isAllSelected, filteredProposals]);

  // Seçilen Teklifleri Toplu Sil
  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    Alert.alert(
      'Teklifleri Sil',
      `Seçilen ${count} adet teklifi silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            const remaining = proposals.filter(p => !selectedIds.has(p.id));
            setProposals(remaining);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
            setIsSelectionMode(false);
            setSelectedIds(new Set());
            setDeletedProposalInfo(null);
            setSnackbarVisible(false);
            Alert.alert('Başarılı', `${count} adet teklif başarıyla silindi.`);
          }
        }
      ]
    );
  }, [selectedIds, proposals]);

  // Virtualized SectionList fonksiyonları (İlk 5 teklif animasyonla gelir, kalanlar animasyonsuz anlık render olur - 60 FPS)
  const renderProposalItem = useCallback(({ item, index }) => {
    const itemIndex = item._overallIndex !== undefined ? item._overallIndex : index;
    const shouldAnimate = itemIndex < 5;
    const isSelected = selectedIds.has(item.id);
    return (
      <ProposalCardItem
        prop={item}
        idx={itemIndex}
        formatUSD={formatUSD}
        isSelectionMode={isSelectionMode}
        isSelected={isSelected}
        onPress={isSelectionMode ? () => handleCardPress(item) : (p, origin) => openProposalModal(p, origin)}
        onLongPress={() => handleCardLongPress(item)}
        deleteCardExiting={deleteCardExiting}
        animatedPrice={false}
        animateEntering={shouldAnimate}
      />
    );
  }, [openProposalModal, formatUSD, isSelectionMode, selectedIds, handleCardPress, handleCardLongPress]);

  const renderSectionHeader = useCallback(({ section: { title } }) => (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.dateGroupHeaderTitle}>{title}</Text>
    </View>
  ), []);

  const proposalKeyExtractor = useCallback((item) => String(item.id), []);

  const renderEmptyList = useCallback(() => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons
            name={searchQuery || activeFilterCount > 0 ? 'search' : 'document-text-outline'}
            size={44}
            color={MS.borderLight}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery || activeFilterCount > 0 ? 'Filtrelere Uygun Teklif Bulunamadı' : 'Henüz Teklif Bulunmuyor'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery || activeFilterCount > 0
            ? 'Belirlediğiniz arama veya filtre kriterlerine uygun kayıtlı bir teklif bulunamadı. Filtreleri temizleyebilirsiniz.'
            : 'Yeni bir asansör motoru teklifi oluşturmak için ana sayfadaki butonu kullanabilirsiniz.'}
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity style={styles.btnResetEmptyFilters} onPress={handleResetAllFilters} activeOpacity={0.75}>
            <Ionicons name="refresh" size={15} color="#107c41" style={{ marginRight: 6 }} />
            <Text style={styles.btnResetEmptyFiltersText}>Filtreleri Temizle</Text>
          </TouchableOpacity>
        )}
        {proposals.length === 0 && !searchQuery && activeFilterCount === 0 && (
          <TouchableOpacity
            style={styles.btnCreateEmpty}
            onPress={() => navigation.navigate('CreateProposal')}
            activeOpacity={0.75}
          >
            <Ionicons name="add" size={18} color="#ffffff" style={{ marginRight: 6 }} />
            <Text style={styles.btnCreateEmptyText}>Teklif Oluştur</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [isLoading, searchQuery, activeFilterCount, proposals.length, handleResetAllFilters, navigation]);

  const renderListFooter = useCallback(() => (
    <View style={{ height: 80 }} />
  ), []);

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* 1. ÜST YEŞİL KURUMSAL BAŞLIK BARI (GPU HIZLANDIRMALI 0-LAG DİNAMİK HEADER) */}
      <Animated.View style={[styles.topGreenHeader, headerAnimatedStyle]}>
        <SafeAreaView>
          {/* Üst Navigasyon Satırı: (Geri/Vazgeç + Dinamik Başlık) + (Filtre/Seçim Aksiyonları) */}
          <Animated.View style={[styles.topNavHeaderRow, navRowAnimatedStyle]}>
            <View style={styles.topHeaderLeftBox}>
              {isSelectionMode ? (
                <TouchableOpacity
                  style={styles.btnBack}
                  onPress={handleExitSelectionMode}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={18} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <Pressable
                  onPress={handleGoBack}
                  onPressIn={handleBackPressIn}
                  onPressOut={handleBackPressOut}
                >
                  <Animated.View style={[styles.btnBack, backAnimatedStyle]}>
                    <Ionicons name="arrow-back" size={17} color="#ffffff" />
                  </Animated.View>
                </Pressable>
              )}

              {/* Dinamik Başlık Alanı (Geri Yazısı -> Başlık Crossfade) */}
              <View style={styles.headerTitleSwapContainer}>
                {/* 1. Scroll Edilmemişken: "Ana Sayfa" / "Vazgeç" */}
                <Animated.View style={[styles.titleSwapItem, backTextAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.btnBackText} numberOfLines={1}>
                    {isSelectionMode ? 'Vazgeç' : 'Ana Sayfa'}
                  </Text>
                </Animated.View>

                {/* 2. Scroll Edilince: "Tüm Teklifler" / "{selectedIds.size} teklif seçildi" */}
                <Animated.View style={[styles.titleSwapItem, smallTitleAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.smallHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">
                    {isSelectionMode
                      ? (selectedIds.size > 0 ? `${selectedIds.size} teklif seçildi` : 'Seçim Yapın')
                      : 'Tüm Teklifler'}
                  </Text>
                </Animated.View>
              </View>
            </View>

            {/* Sağ Üst Aksiyonlar: Normal Modda (Teklif Sayısı + Filtrele), Seçim Modunda (Tümü + Sil) */}
            {isSelectionMode ? (
              <View style={styles.selectionActionsRight}>
                <TouchableOpacity
                  style={styles.btnSelectAllHeader}
                  onPress={handleToggleSelectAll}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isAllSelected ? "checkbox" : "square-outline"}
                    size={15}
                    color="#ffffff"
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.btnSelectAllHeaderText}>
                    {isAllSelected ? 'Temizle' : 'Tümü'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btnDeleteSelectedHeader,
                    selectedIds.size === 0 && { opacity: 0.5 }
                  ]}
                  disabled={selectedIds.size === 0}
                  onPress={handleDeleteSelected}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={15} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.btnDeleteSelectedHeaderText}>Sil ({selectedIds.size})</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.topHeaderRightActions}>
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{filteredProposals.length} Teklif</Text>
                </View>

                <TouchableOpacity
                  onPress={handleOpenFilterModal}
                  style={[
                    styles.btnFilter,
                    activeFilterCount > 0 && styles.btnFilterActive
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={activeFilterCount > 0 ? 'funnel' : 'filter-outline'}
                    size={15}
                    color="#ffffff"
                    style={{ marginRight: 5 }}
                  />
                  <Text style={styles.btnFilterText}>Filtrele</Text>
                  {activeFilterCount > 0 && (
                    <View style={styles.filterBadgeCount}>
                      <Text style={styles.filterBadgeCountText}>{activeFilterCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Alt Satır: Büyük Başlık (Scroll ile yukarı doğru süzülerek kaybolur) */}
          <Animated.View style={[styles.titleRowContainer, titleRowAnimatedStyle]}>
            <Text style={styles.pageHeaderTitle} numberOfLines={1}>
              {isSelectionMode
                ? (selectedIds.size > 0 ? `${selectedIds.size} teklif seçildi` : 'Teklif seçiniz')
                : 'Tüm Teklifler'}
            </Text>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>

      {/* --- TEKLİFLER VIRTUALIZED LİSTESİ (SADECE EKRANDA GÖZÜKENLER RENDER EDİLİR - 60 FPS) --- */}
      <AnimatedSectionList
        sections={sections}
        extraData={selectedIds}
        keyExtractor={proposalKeyExtractor}
        renderItem={renderProposalItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={
          <ProposalListHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeFilterCount={activeFilterCount}
            filterCurrency={filterCurrency}
            setFilterCurrency={setFilterCurrency}
            filterMinPrice={filterMinPrice}
            setFilterMinPrice={setFilterMinPrice}
            filterMaxPrice={filterMaxPrice}
            setFilterMaxPrice={setFilterMaxPrice}
            filterPeriod={filterPeriod}
            setFilterPeriod={setFilterPeriod}
            filterStartDate={filterStartDate}
            setFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate}
            setFilterEndDate={setFilterEndDate}
            filterSort={filterSort}
            setFilterSort={setFilterSort}
            handleResetAllFilters={handleResetAllFilters}
          />
        }
        ListEmptyComponent={renderEmptyList}
        ListFooterComponent={renderListFooter}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
      />

      {/* SAĞ ALTTAKİ TEKLİF OLUŞTUR BUTONU (FAB) */}
      {!isSelectionMode && (
        <Animated.View
          entering={FadeInUp.duration(300).delay(80).easing(Easing.out(Easing.cubic))}
          style={styles.floatingButtonWrapper}
        >
          <Pressable
            onPress={() => navigation.navigate('CreateProposal')}
            onPressIn={handleFabPressIn}
            onPressOut={handleFabPressOut}
          >
            <Animated.View style={[styles.floatingButton, fabAnimatedStyle]}>
              <Ionicons name="add" size={22} color={MS.accent} style={{ marginRight: 6 }} />
              <Text style={styles.floatingButtonText}>TEKLİF OLUŞTUR</Text>
            </Animated.View>
          </Pressable>
        </Animated.View>
      )}

      {/* --- GELİŞMİŞ FİLTRELEME & SIRALAMA MODALI (EKRANIN ORTASINDA) --- */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setFilterModalVisible(false)}
        >
          <Pressable style={styles.modalDialogCard} onPress={(e) => e.stopPropagation && e.stopPropagation()}>
            {/* 1. Modal Başlık */}
            <View style={styles.modalDialogHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="options-outline" size={19} color="#107c41" style={{ marginRight: 8 }} />
                <Text style={styles.modalDialogTitle}>Filtrele & Sırala</Text>
              </View>

              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                style={styles.btnModalClose}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* 2. Filtre Seçenekleri */}
            <ScrollView
              style={styles.modalDialogScroll}
              contentContainerStyle={styles.modalDialogScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {/* FİYAT ARALIĞI */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>FİYAT ARALIĞI</Text>
                <View style={styles.priceRow}>
                  <View style={styles.priceInputBox}>
                    <Text style={styles.pricePrefix}>Min</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      placeholderTextColor="#94a3b8"
                      value={draftMinPrice}
                      onChangeText={setDraftMinPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <Text style={styles.priceDash}>-</Text>
                  <View style={styles.priceInputBox}>
                    <Text style={styles.pricePrefix}>Max</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="Limitsiz"
                      placeholderTextColor="#94a3b8"
                      value={draftMaxPrice}
                      onChangeText={setDraftMaxPrice}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* PARA BİRİMİ */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>PARA BİRİMİ</Text>
                <View style={styles.btnRow}>
                  {[
                    { id: 'ALL', label: 'Tümü' },
                    { id: 'USD', label: 'USD ($)' },
                    { id: 'TL', label: 'TL (₺)' },
                    { id: 'EUR', label: 'EUR (€)' }
                  ].map((opt, idx, arr) => {
                    const active = draftCurrency === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.segmentBtn,
                          idx === arr.length - 1 && { borderRightWidth: 0 },
                          active && styles.segmentBtnActive
                        ]}
                        onPress={() => setDraftCurrency(opt.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.segmentBtnText, active && styles.segmentBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* TARİH / DÖNEM */}
              <View style={styles.filterSection}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={[styles.filterLabel, { marginBottom: 0 }]}>TARİH / DÖNEM</Text>
                  {draftPeriod === 'CUSTOM' && (draftStartDate || draftEndDate) && (
                    <TouchableOpacity
                      onPress={() => {
                        setDraftStartDate(null);
                        setDraftEndDate(null);
                        setDraftPeriod('ALL');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontFamily: MS.fontFamilyBold, fontSize: 11, color: '#e11d48' }}>
                        Aralığı Sıfırla
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.chipsWrap}>
                  {[
                    { id: 'ALL', label: 'Tümü', icon: 'apps-outline' },
                    { id: 'TODAY', label: 'Bugün', icon: 'today-outline' },
                    { id: 'WEEK', label: 'Bu Hafta', icon: 'calendar-number-outline' },
                    { id: 'MONTH', label: 'Bu Ay', icon: 'calendar-outline' },
                    { id: 'YEAR', label: 'Bu Yıl', icon: 'calendar-clear-outline' },
                    { id: 'CUSTOM', label: 'Özel Aralık', icon: 'calendar' }
                  ].map((opt) => {
                    const active = draftPeriod === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.chipItem, active && styles.chipItemActive]}
                        onPress={() => {
                          setDraftPeriod(opt.id);
                          if (opt.id === 'CUSTOM') {
                            setCalendarModalVisible(true);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={14}
                          color={active ? '#ffffff' : '#475569'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.chipItemText, active && styles.chipItemTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* ÖZEL ARALIK SEÇİLDİYSE SEÇİLİ TARİH ARALIĞI KARTINI GÖSTER */}
                {draftPeriod === 'CUSTOM' && (
                  <View style={styles.customDateCard}>
                    <TouchableOpacity
                      style={styles.customDateCardLeft}
                      onPress={() => setCalendarModalVisible(true)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.calendarIconBox}>
                        <Ionicons name="calendar" size={16} color="#107c41" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customDateCardLabel}>Seçili Tarih Aralığı</Text>
                        <Text style={styles.customDateCardValue} numberOfLines={1}>
                          {draftStartDate && draftEndDate
                            ? `${formatTurkishDate(draftStartDate)} — ${formatTurkishDate(draftEndDate)}`
                            : draftStartDate
                              ? `>= ${formatTurkishDate(draftStartDate)}`
                              : draftEndDate
                                ? `<= ${formatTurkishDate(draftEndDate)}`
                                : 'Tarih seçmek için dokunun'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.customDateCardActions}>
                      <TouchableOpacity
                        style={styles.btnChangeDate}
                        onPress={() => setCalendarModalVisible(true)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.btnChangeDateText}>
                          {draftStartDate || draftEndDate ? 'Değiştir' : 'Seç'}
                        </Text>
                      </TouchableOpacity>

                      {(draftStartDate || draftEndDate) && (
                        <TouchableOpacity
                          style={styles.btnRemoveDate}
                          onPress={() => {
                            setDraftStartDate(null);
                            setDraftEndDate(null);
                          }}
                          activeOpacity={0.7}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </View>

              {/* SIRALAMA ÖLÇÜTÜ */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>SIRALAMA ÖLÇÜTÜ</Text>
                <View style={styles.chipsWrap}>
                  {[
                    { id: 'DATE_DESC', label: 'En Yeni İlk', icon: 'time-outline' },
                    { id: 'DATE_ASC', label: 'En Eski İlk', icon: 'hourglass-outline' },
                    { id: 'PRICE_DESC', label: 'Fiyat: Azalan', icon: 'trending-down-outline' },
                    { id: 'PRICE_ASC', label: 'Fiyat: Artan', icon: 'trending-up-outline' },
                    { id: 'NAME_ASC', label: 'Firma Adı (A-Z)', icon: 'text-outline' }
                  ].map((opt) => {
                    const active = draftSort === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.chipItem, active && styles.chipItemActive]}
                        onPress={() => setDraftSort(opt.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={opt.icon}
                          size={14}
                          color={active ? '#ffffff' : '#475569'}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.chipItemText, active && styles.chipItemTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* 3. Modal Alt Butonları */}
            <View style={styles.modalDialogFooter}>
              <TouchableOpacity
                style={styles.btnResetModal}
                onPress={handleResetDraftFilters}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={15} color="#475569" style={{ marginRight: 5 }} />
                <Text style={styles.btnResetModalText}>Sıfırla</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnApplyModal}
                onPress={handleApplyFilters}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-sharp" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.btnApplyModalText}>
                  {`Uygula (${draftMatchCount} Sonuç)`}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* --- TARİH ARALIĞI SEÇİM MODALI --- */}
      <DateRangeModal
        visible={calendarModalVisible}
        onClose={() => setCalendarModalVisible(false)}
        startDate={draftStartDate}
        endDate={draftEndDate}
        onApply={({ startDate, endDate }) => {
          setDraftStartDate(startDate);
          setDraftEndDate(endDate);
          setDraftPeriod('CUSTOM');
        }}
        onClear={() => {
          setDraftStartDate(null);
          setDraftEndDate(null);
        }}
      />

      {/* --- UYGULAMA İÇİ CANLI DÜZENLENEBİLİR PDF ÖNİZLEME MODALI --- */}
      <ProposalPreviewModal
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        proposalRecord={activeProposalRecord}
        onSaveUpdatedRecord={handleSaveUpdatedRecord}
      />

      {/* --- ÖZEL GELİŞMİŞ TEKLİF DETAY MODALI (IPHONE APP LAUNCH EXPAND TRANSITION) --- */}
      <ProposalActionModal
        visible={actionModalVisible}
        onClose={closeProposalModal}
        proposal={selectedProposal}
        originLayout={cardOrigin}
        onPreview={handleOpenPreview}
        onShare={handleShareProposal}
        onDelete={handleDeleteProposal}
        formatUSD={formatUSD}
      />

      {/* GERİ AL BUTONLU BİLDİRİM ÇUBUĞU (SNACKBAR) */}
      {snackbarVisible && deletedProposalInfo && (
        <Animated.View
          entering={SlideInDown.duration(280).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(220).easing(Easing.in(Easing.cubic))}
          style={styles.snackbarWrapper}
        >
          <View style={styles.snackbarBox}>
            <View style={styles.snackbarLeft}>
              <Ionicons name="trash-outline" size={17} color="#64748b" style={{ marginRight: 8 }} />
              <Text style={styles.snackbarText} numberOfLines={1}>
                "{deletedProposalInfo.item.firma || `Teklif #${deletedProposalInfo.item.teklifNo}`}" silindi
              </Text>
            </View>

            <TouchableOpacity
              style={styles.btnSnackbarUndo}
              onPress={handleUndoDelete}
              activeOpacity={0.75}
            >
              <Text style={styles.btnSnackbarUndoText}>GERİ AL</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#107c41',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: -4, height: 0 },
        shadowOpacity: 0.12,
        shadowRadius: 10
      },
      android: {
        elevation: 8
      }
    })
  },
  topGreenHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    zIndex: 100,
    backgroundColor: '#107c41',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingHorizontal: 16,
    overflow: 'hidden'
  },
  topNavHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 32,
    marginBottom: 8
  },
  topHeaderLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8
  },
  btnBack: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 0,
    backgroundColor: 'transparent'
  },
  headerTitleSwapContainer: {
    marginLeft: 8,
    flex: 1,
    height: 32,
    justifyContent: 'center'
  },
  titleSwapItem: {
    position: 'absolute',
    left: 0,
    right: 0,
    justifyContent: 'center'
  },
  btnBackText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#ffffff'
  },
  smallHeaderTitleText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14.5,
    color: '#ffffff',
    letterSpacing: 0.1
  },
  topHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 0
  },
  headerBadgeText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#ffffff'
  },
  btnFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 0
  },
  btnFilterActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderColor: '#ffffff',
    borderWidth: 1.5
  },
  btnFilterText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: '#ffffff'
  },
  filterBadgeCount: {
    backgroundColor: '#e11d48',
    marginLeft: 5,
    minWidth: 17,
    height: 17,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3
  },
  filterBadgeCountText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 10,
    color: '#ffffff'
  },
  titleRowContainer: {
    justifyContent: 'center',
    marginTop: 2,
    overflow: 'hidden'
  },
  pageHeaderTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: 0.2
  },

  // Çoklu Seçim Modu Header Butonları
  btnCancelSelection: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  btnCancelSelectionText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#ffffff'
  },
  selectionActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnSelectAllHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 0
  },
  btnSelectAllHeaderText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: '#ffffff'
  },
  btnDeleteSelectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dc2626',
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 0
  },
  btnDeleteSelectedHeaderText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#ffffff'
  },

  // Arama Çubuğu Stilleri
  listHeaderWrapper: {
    paddingBottom: 4
  },
  searchSection: {
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: 'transparent'
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7
  },
  searchBoxFocused: {
    borderColor: MS.success,
    backgroundColor: '#ffffff'
  },
  searchInput: {
    flex: 1,
    fontFamily: MS.fontFamily,
    fontSize: 14,
    color: MS.textPrimary,
    padding: 0
  },

  // Aktif Filtreler Şeridi
  activeFiltersContainer: {
    backgroundColor: 'transparent',
    marginBottom: 6
  },
  activeFiltersScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4
  },
  clearAllBottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 2
  },
  activeFilterCountTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 0
  },
  activeFilterCountTagText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#107c41'
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 0,
    maxWidth: 280
  },
  filterChipText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11,
    color: '#334155',
    flexShrink: 1
  },
  filterClearAllChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 0
  },
  filterClearAllText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#e11d48'
  },

  scrollView: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: HEADER_HEIGHT + 6,
    paddingBottom: 150,
    backgroundColor: '#fafafaff'
  },

  // SAĞ ALTTAKİ TEKLİF OLUŞTUR BUTONU (FAB)
  floatingButtonWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 85,
    right: 18,
    zIndex: 99
  },
  floatingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: MS.accent,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 0,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6
  },
  floatingButtonText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13,
    color: MS.accent,
    letterSpacing: 0.5
  },
  btnCreateEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: '#107c41',
    borderRadius: 0
  },
  btnCreateEmptyText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#ffffff'
  },

  emptyContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 8
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 0,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  emptyTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: MS.textPrimary,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    color: MS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 290
  },
  btnResetEmptyFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#107c41',
    borderRadius: 0
  },
  btnResetEmptyFiltersText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41'
  },

  // --- SOLA DAYALI TARİH GRUBU STİLLERİ ---
  sectionHeaderContainer: {
    backgroundColor: 'transparent',
    paddingTop: 6,
    paddingBottom: 2
  },
  dateGroupContainer: {
    marginBottom: 8
  },
  dateGroupHeaderTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14,
    color: '#334155',
    textAlign: 'left',
    marginBottom: 8,
    marginTop: 6,
    paddingHorizontal: 2,
    letterSpacing: 0.3
  },

  // --- MERKEZİ (ORTADA) FİLTRE MODALI STİLLERİ ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalDialogCard: {
    width: '100%',
    maxWidth: 420,
    height: '84%',
    maxHeight: 680,
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
  modalDialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#f8fafc'
  },
  modalDialogTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 16,
    color: '#0f172a'
  },
  btnModalClose: {
    padding: 6,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0
  },
  modalDialogScroll: {
    flex: 1
  },
  modalDialogScrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12
  },
  filterSection: {
    marginBottom: 22
  },
  filterLabel: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11.5,
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  priceInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7
  },
  pricePrefix: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#64748b',
    marginRight: 6
  },
  priceInput: {
    flex: 1,
    fontFamily: MS.fontFamily,
    fontSize: 13.5,
    color: MS.textPrimary,
    padding: 0
  },
  priceDash: {
    paddingHorizontal: 8,
    color: '#94a3b8',
    fontFamily: MS.fontFamilyBold
  },
  btnRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0,
    backgroundColor: '#ffffff',
    overflow: 'hidden'
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0'
  },
  segmentBtnActive: {
    backgroundColor: '#107c41'
  },
  segmentBtnText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#475569'
  },
  segmentBtnTextActive: {
    fontFamily: MS.fontFamilyBold,
    color: '#ffffff'
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 0,
    marginRight: 8,
    marginBottom: 8
  },
  chipItemActive: {
    backgroundColor: '#107c41',
    borderColor: '#107c41'
  },
  chipItemText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#334155'
  },
  chipItemTextActive: {
    fontFamily: MS.fontFamilyBold,
    color: '#ffffff'
  },
  customDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 0,
    marginTop: 8
  },
  customDateCardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8
  },
  calendarIconBox: {
    width: 32,
    height: 32,
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    alignItems: 'center',
    justifyContent: 'center'
  },
  customDateCardLabel: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 9.5,
    color: '#107c41',
    letterSpacing: 0.3
  },
  customDateCardValue: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#0f172a',
    marginTop: 2
  },
  customDateCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnChangeDate: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#107c41',
    borderRadius: 0
  },
  btnChangeDateText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#107c41'
  },
  btnRemoveDate: {
    padding: 3
  },
  modalDialogFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 10
  },
  btnResetModal: {
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
  btnResetModalText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#475569'
  },
  btnApplyModal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 18,
    backgroundColor: '#107c41',
    borderRadius: 0
  },
  btnApplyModalText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13.5,
    color: '#ffffff'
  },

  // --- ÖZEL GELİŞMİŞ BOTTOM SHEET AKSİYON MODALI STİLLERİ ---
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)'
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '88%',
    minHeight: 520,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
    margin: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 28
  },
  sheetScrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 16 : 24
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 14
  },
  sheetMotorSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginTop: 10,
    marginBottom: 4
  },
  sheetMotorSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  sheetMotorHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  sheetMotorSectionTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#334155',
    letterSpacing: 0.3,
    textTransform: 'uppercase'
  },
  sheetMotorTotalBadge: {
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 0
  },
  sheetMotorTotalBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: MS.primary
  },
  sheetMotorList: {
    gap: 6
  },
  sheetMotorItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  sheetMotorQtyBadge: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 0,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetMotorQtyBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11.5,
    color: '#000000'
  },
  sheetMotorInfoCol: {
    flex: 1
  },
  sheetMotorModelText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13.5,
    color: '#0f172a',
    marginBottom: 1
  },
  sheetMotorSpecsText: {
    fontFamily: MS.fontFamily,
    fontSize: 11.5,
    color: '#64748b'
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 0,
    alignSelf: 'center',
    marginBottom: 14
  },
  sheetHeader: {
    marginBottom: 8
  },
  sheetHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  sheetBadge: {
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#bbf0c8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 0
  },
  sheetBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: MS.primary,
    letterSpacing: 0.5
  },
  sheetDateText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: MS.textMuted
  },
  sheetClientTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 18,
    color: MS.textPrimary,
    marginBottom: 3
  },
  sheetClientSub: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: MS.textSecondary,
    marginBottom: 6
  },
  sheetAmountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: MS.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 6,
    borderRadius: 0
  },
  sheetAmountLabel: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: MS.textSecondary
  },
  sheetAmountValue: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 17,
    color: MS.success
  },
  sheetDivider: {
    height: 1,
    backgroundColor: MS.borderSubtle,
    marginVertical: 12
  },
  sheetActionsList: {
    gap: 10,
    marginBottom: 14
  },
  sheetActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderRadius: 0
  },
  sheetActionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  sheetActionTextCol: {
    flex: 1
  },
  sheetActionTitle: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 14,
    color: MS.textPrimary,
    marginBottom: 2
  },
  sheetActionSub: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: MS.textMuted
  },
  btnSheetClose: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    backgroundColor: '#f1f3f4',
    borderRadius: 0
  },
  btnSheetCloseText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 14,
    color: MS.textSecondary
  },

  // --- GERİ AL SNACKBAR STİLLERİ ---
  snackbarWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 76 : 64,
    left: 16,
    right: 16,
    zIndex: 99999,
    elevation: 99
  },
  snackbarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 25
  },
  snackbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
  },
  snackbarText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13,
    color: '#0f172a',
    flex: 1
  },
  btnSnackbarUndo: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: '#eef8f1',
    borderWidth: 1.5,
    borderColor: '#107c41',
    borderRadius: 0
  },
  btnSnackbarUndoText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41',
    letterSpacing: 0.5
  }
});
