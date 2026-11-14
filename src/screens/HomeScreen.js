import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  Platform,
  Image,
  Pressable
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  SlideInLeft,
  SlideOutLeft,
  FadeInDown,
  FadeInUp,
  FadeOutUp,
  FadeInLeft,
  FadeInRight,
  ZoomIn,
  LinearTransition,
  Keyframe,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS, STORAGE_KEY } from '../constants/theme';
import { exportAndSharePDF } from '../utils/pdfGenerator';
import ProposalPreviewModal from '../components/ProposalPreviewModal';
import ProposalActionModal from '../components/ProposalActionModal';
import ProposalCardItem from '../components/ProposalCardItem';
import ProposalMotorTable from '../components/ProposalMotorTable';
import AnimatedCounter from '../components/AnimatedCounter';
import { ProposalListSkeleton } from '../components/SkeletonLoader';
import { getSmartDateLabel } from '../utils/dateUtils';
import { getProposalMotors } from '../utils/proposalUtils';
import { fetchLiveRates, getCachedRates } from '../utils/currencyService';

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

const TOTAL_ARROW_ITEMS = 13.0; // 0 to 13
const BEAM_WIDTH = 0.20;

const AnimatedHorizontalSegment = React.memo(function AnimatedHorizontalSegment({ index, progress }) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const t = progress.value;
    const center = index / TOTAL_ARROW_ITEMS;
    const dist = Math.abs(t - center);
    let factor = 0;
    if (dist < BEAM_WIDTH) {
      factor = Math.cos((dist / BEAM_WIDTH) * (Math.PI / 2));
    }
    return {
      opacity: 0.20 + 0.80 * factor,
      transform: [{ scale: 1 + 0.15 * factor }]
    };
  });

  return <Animated.View style={[styles.arrowSegmentH, animatedStyle]} />;
});

const AnimatedCornerSegment = React.memo(function AnimatedCornerSegment({ index, progress }) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const t = progress.value;
    const center = index / TOTAL_ARROW_ITEMS;
    const dist = Math.abs(t - center);
    let factor = 0;
    if (dist < BEAM_WIDTH) {
      factor = Math.cos((dist / BEAM_WIDTH) * (Math.PI / 2));
    }
    return {
      opacity: 0.20 + 0.80 * factor,
      transform: [{ scale: 1 + 0.15 * factor }]
    };
  });

  return <Animated.View style={[styles.arrowCorner, animatedStyle]} />;
});

const AnimatedVerticalSegment = React.memo(function AnimatedVerticalSegment({ index, progress }) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const t = progress.value;
    const center = index / TOTAL_ARROW_ITEMS;
    const dist = Math.abs(t - center);
    let factor = 0;
    if (dist < BEAM_WIDTH) {
      factor = Math.cos((dist / BEAM_WIDTH) * (Math.PI / 2));
    }
    return {
      opacity: 0.20 + 0.80 * factor,
      transform: [{ scale: 1 + 0.15 * factor }]
    };
  });

  return <Animated.View style={[styles.arrowSegmentV, animatedStyle]} />;
});

const AnimatedArrowHeadDown = React.memo(function AnimatedArrowHeadDown({ index, progress }) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const t = progress.value;
    const center = index / TOTAL_ARROW_ITEMS;
    const dist = Math.abs(t - center);
    let factor = 0;
    if (dist < BEAM_WIDTH) {
      factor = Math.cos((dist / BEAM_WIDTH) * (Math.PI / 2));
    }
    return {
      opacity: 0.20 + 0.80 * factor,
      transform: [
        { scale: 1 + 0.22 * factor },
        { translateY: factor * 3 }
      ]
    };
  });

  return (
    <Animated.View style={[styles.arrowHeadDownBox, animatedStyle]}>
      <Ionicons name="arrow-down-sharp" size={28} color="#107c41" />
    </Animated.View>
  );
});

export default function HomeScreen({ navigation }) {
  const [recentProposals, setRecentProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rates, setRates] = useState({ usd: null, eur: null, loading: true });

  // Özel Teklif Aksiyon Modalı
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [cardOrigin, setCardOrigin] = useState(null);

  // Sağ Üst Dropdown Menü Durumu
  const [dropdownVisible, setDropdownVisible] = useState(false);

  // Teklif Oluştur (FAB) basma animasyonu (Yaylanma olmadan pürüzsüz)
  const fabScale = useSharedValue(1);
  const fabOpacity = useSharedValue(1);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
    opacity: fabOpacity.value
  }));

  const handleFabPressIn = () => {
    fabScale.value = withTiming(0.95, {
      duration: 110,
      easing: Easing.out(Easing.quad)
    });
    fabOpacity.value = withTiming(0.9, {
      duration: 110,
      easing: Easing.out(Easing.quad)
    });
  };

  const handleFabPressOut = () => {
    fabScale.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.quad)
    });
    fabOpacity.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.quad)
    });
  };

  // Çapraz parçalı ok için gecikmeli dalga (opacity) animasyonu
  const waveProgress = useSharedValue(0);

  useEffect(() => {
    waveProgress.value = 0;
    waveProgress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: Easing.linear }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  // Silinen teklifi geri alma (Snackbar) durumu
  const [deletedProposalInfo, setDeletedProposalInfo] = useState(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const snackbarTimerRef = useRef(null);

  // Uygulama içi önizleme modalı
  const [previewVisible, setPreviewVisible] = useState(false);
  const [activeProposalRecord, setActiveProposalRecord] = useState(null);

  // Sayfa her odaklandığında kayıtlı teklifleri yeniden oku
  useFocusEffect(
    useCallback(() => {
      const loadProposals = async () => {
        try {
          const stored = await AsyncStorage.getItem(STORAGE_KEY);
          if (stored) {
            setRecentProposals(JSON.parse(stored));
          } else {
            setRecentProposals([]);
          }
        } catch (e) {
          console.log('Teklifler yüklenemedi:', e);
        } finally {
          setIsLoading(false);
        }
      };
      loadProposals();
    }, [])
  );

  // Canlı Döviz Kurlarını Çek (Yedekli ve Önbellekli Servis)
  const fetchRates = useCallback(async () => {
    setRates(prev => ({ ...prev, loading: true }));
    try {
      const live = await fetchLiveRates();
      if (live && live.usd && live.eur) {
        setRates({ usd: live.usd, eur: live.eur, loading: false });
      } else {
        setRates(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setRates(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    // 1. Önce önbellekteki kurları hemen yükle (Gecikmesiz görünüm)
    getCachedRates().then(cached => {
      if (cached && cached.usd && cached.eur) {
        setRates(prev => ({ ...prev, usd: cached.usd, eur: cached.eur }));
      }
    });
    // 2. Arka planda canlı kurları güncelle
    fetchRates();
  }, [fetchRates]);

  const formatUSD = useCallback((val, currency = 'USD') => {
    const sym = currency === 'TL' ? '₺ ' : currency === 'EUR' ? '€ ' : '$ ';
    return sym + Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  // Ana sayfada en fazla 8 teklif göster (Kasmayı önler, yüksek performans sağlar)
  const displayedProposals = useMemo(() => {
    return recentProposals.slice(0, 8);
  }, [recentProposals]);

  // Son 8 teklifi sola dayalı akıllı tarihlere göre gruplandır
  const groupedRecentProposals = useMemo(() => {
    const groups = [];
    const map = new Map();

    displayedProposals.forEach((prop) => {
      const label = getSmartDateLabel(prop.tarih, prop.id);
      if (!map.has(label)) {
        const newGroup = {
          dateLabel: label,
          items: []
        };
        map.set(label, newGroup);
        groups.push(newGroup);
      }
      map.get(label).items.push(prop);
    });

    return groups;
  }, [displayedProposals]);

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
        setRecentProposals(nextList);
      }
    } catch (e) {
      console.log('Teklif kaydı güncellenemedi:', e);
    }
  };

  // Teklif Sil ve Geri Almayı Başlat
  const handleDeleteProposal = async (proposalToDelete) => {
    closeProposalModal();
    if (!proposalToDelete) return;

    const originalIndex = recentProposals.findIndex(p => p.id === proposalToDelete.id);
    const filtered = recentProposals.filter(p => p.id !== proposalToDelete.id);

    // Listeyi güncelle (Reanimated layout + exit animasyonu tetiklenir)
    setRecentProposals(filtered);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

    // Snackbar göster ve geri alma bilgisini kaydet
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
    const nextList = [...recentProposals];
    if (index >= 0 && index <= nextList.length) {
      nextList.splice(index, 0, item);
    } else {
      nextList.unshift(item);
    }

    setRecentProposals(nextList);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    setDeletedProposalInfo(null);
  };

  // Özel Teklif Aksiyon Modalı Aç/Kapat
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

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* EN ÜST YEŞİL STATUS BAR & HEADER BARI */}
      <View style={styles.topGreenHeader}>
        <SafeAreaView>
          <View style={styles.headerContent}>
            <View style={styles.logoAndTitle}>
              <Image
                source={require('../../assets/sng_logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.titleContainer}>
                <Text style={styles.appTitle}>SNG LIFT</Text>
                <Text style={styles.appSubtitle}>Teklif Yönetimi</Text>
              </View>
            </View>

            {/* Sağ Bölüm: Haber İkonu & Dikey 3 Nokta Ayarlar Butonu */}
            <View style={styles.headerRightSection}>
              <TouchableOpacity
                style={styles.btnHeaderNews}
                onPress={() => navigation.navigate('EconomyNews')}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 10, right: 6 }}
              >
                <Ionicons name="newspaper-outline" size={20} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnHeaderSettings}
                onPress={() => setDropdownVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 12, bottom: 12, left: 6, right: 12 }}
              >
                <Ionicons name="ellipsis-vertical" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* ANA SAYFA İÇERİK ALANI */}
      <View style={styles.bodyContainer}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* --- CANLI DÖVİZ KURLARI KARTI (AÇIK GRİ KART) --- */}
          <View style={styles.ratesCard}>
            <View style={styles.ratesCardLeft}>
              <View style={styles.livePulseDot} />
              <Text style={styles.ratesCardHeaderTitle}>Canlı Kurlar</Text>
            </View>

            <View style={styles.ratesValuesContainer}>
              {/* USD */}
              <View style={styles.rateBadgeBox}>
                <Ionicons name="logo-usd" size={13} color="#107c41" />
                <Text style={styles.rateBadgeCode}>USD</Text>
                <Text style={styles.rateBadgeValue}>{rates.usd ? `${rates.usd} ₺` : '...'}</Text>
              </View>

              <View style={styles.ratesDivider} />

              {/* EUR */}
              <View style={styles.rateBadgeBox}>
                <Ionicons name="logo-euro" size={13} color="#107c41" />
                <Text style={styles.rateBadgeCode}>EUR</Text>
                <Text style={styles.rateBadgeValue}>{rates.eur ? `${rates.eur} ₺` : '...'}</Text>
              </View>

              {/* Yenileme Butonu */}
              <TouchableOpacity
                onPress={fetchRates}
                style={styles.btnRefreshRates}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="refresh"
                  size={14}
                  color={rates.loading ? '#107c41' : '#555555'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Son Yazılan Teklifler Başlığı */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son Yazılan Teklifler</Text>
            {recentProposals.length > 0 && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AllProposals')}
                activeOpacity={0.7}
                style={styles.btnSeeAll}
              >
                <Text style={styles.seeAllText}>Tüm Teklifleri Gör</Text>
                <Ionicons name="chevron-forward" size={14} color={MS.accent} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            )}
          </View>

          {/* Teklif Listesi VEYA İskelet VEYA Boş Durum */}
          {isLoading ? (
            <ProposalListSkeleton count={3} />
          ) : recentProposals.length === 0 ? (
            <View style={styles.emptyContainer}>
              {/* İllüstrasyon Tarzı Güzel Animasyonlu İkon Grubu */}
              <View style={styles.emptyIllustrationWrapper}>
                <Animated.View
                  entering={FadeIn.duration(400).delay(100).easing(Easing.out(Easing.quad))}
                  style={styles.emptyIllustrationLeft}
                >
                  <Ionicons name="calculator-outline" size={20} color="#64748b" />
                </Animated.View>

                <Animated.View
                  entering={FadeIn.duration(400).delay(220).easing(Easing.out(Easing.quad))}
                  style={styles.emptyIllustrationCenter}
                >
                  <Ionicons name="document-text-outline" size={30} color="#107c41" />
                </Animated.View>

                <Animated.View
                  entering={FadeIn.duration(400).delay(340).easing(Easing.out(Easing.quad))}
                  style={styles.emptyIllustrationRight}
                >
                  <Ionicons name="trending-up-outline" size={20} color="#64748b" />
                </Animated.View>
              </View>

              {/* Başlık (Sabit Kalır) */}
              <Text style={styles.emptyTitle}>Henüz Teklif Bulunmuyor</Text>

              {/* Sol Metinle Başlayıp Sağa Giden ve Kıvrılarak Aşağı Butona İnen Rehber Yol */}
              <View style={styles.guidePathContainer}>
                {/* Üst Satır: Sol Sade Metin + Uzatılmış Yatay Parçalar + Küçük Kıvrımlı Köşe */}
                <View style={styles.guideTopRow}>
                  <Text style={styles.guideText}>İlk teklifinizi oluşturun</Text>

                  <View style={styles.guideHorizontalTrack}>
                    <AnimatedHorizontalSegment index={0} progress={waveProgress} />
                    <AnimatedHorizontalSegment index={1} progress={waveProgress} />
                    <AnimatedHorizontalSegment index={2} progress={waveProgress} />
                    <AnimatedHorizontalSegment index={3} progress={waveProgress} />
                    <AnimatedCornerSegment index={4} progress={waveProgress} />
                  </View>
                </View>

                {/* Sağ Dikey İniş: İyice Uzatılmış Dikey Parçalar ve Butonu Gösteren Aşağı Ok */}
                <View style={styles.guideVerticalCol}>
                  <AnimatedVerticalSegment index={5} progress={waveProgress} />
                  <AnimatedVerticalSegment index={6} progress={waveProgress} />
                  <AnimatedVerticalSegment index={7} progress={waveProgress} />
                  <AnimatedVerticalSegment index={8} progress={waveProgress} />
                  <AnimatedVerticalSegment index={9} progress={waveProgress} />
                  <AnimatedVerticalSegment index={10} progress={waveProgress} />
                  <AnimatedVerticalSegment index={11} progress={waveProgress} />
                  <AnimatedVerticalSegment index={12} progress={waveProgress} />
                  <AnimatedArrowHeadDown index={13} progress={waveProgress} />
                </View>
              </View>
            </View>
          ) : (
            <>
              {groupedRecentProposals.map((group, groupIdx) => (
                <View key={group.dateLabel + groupIdx} style={styles.dateGroupContainer}>
                  {/* SOLA DAYALI TEK BİR TARİH BAŞLIĞI */}
                  <Text style={styles.dateGroupHeaderTitle}>{group.dateLabel}</Text>

                  {/* O TARİHTEKİ TÜM TEKLİFLER */}
                  {group.items.map((prop, idx) => (
                    <ProposalCardItem
                      key={prop.id}
                      prop={prop}
                      idx={idx}
                      formatUSD={formatUSD}
                      onPress={(item, origin) => openProposalModal(item, origin)}
                      deleteCardExiting={deleteCardExiting}
                      animatedPrice={false}
                      animateEntering={idx < 5}
                    />
                  ))}
                </View>
              ))}

              {/* LİSTE ALTINDAKİ TÜMÜNÜ GÖR BUTONU */}
              {recentProposals.length > 0 && (
                <TouchableOpacity
                  style={styles.btnSeeAllBottom}
                  onPress={() => navigation.navigate('AllProposals')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnSeeAllBottomText}>
                    Tüm Teklifleri Gör
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color={MS.accent} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              )}
            </>
          )}

          <View style={{ height: 160 }} />
        </ScrollView>

        {/* SAĞ ALTTAKİ TEKLİF OLUŞTUR BUTONU (FAB) */}
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

        {/* --- UYGULAMA İÇİ CANLI DÜZENLENEBİLİR PDF ÖNİZLEME MODALI --- */}
        <ProposalPreviewModal
          visible={previewVisible}
          onClose={() => setPreviewVisible(false)}
          proposalRecord={activeProposalRecord}
          onSaveUpdatedRecord={handleSaveUpdatedRecord}
        />
      </View>

      {/* --- SAĞ ÜST AÇILIR DROPDOWN MENÜ MODALI (YUKARIDAN AŞAĞIYA DOĞRU) --- */}
      <Modal
        visible={dropdownVisible}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setDropdownVisible(false)}
      >
        <Pressable
          style={styles.dropdownBackdrop}
          onPress={() => setDropdownVisible(false)}
        >
          <Animated.View
            entering={FadeInDown.duration(200).easing(Easing.out(Easing.quad))}
            exiting={FadeOutUp.duration(150).easing(Easing.in(Easing.quad))}
            style={styles.dropdownMenuCard}
          >
            {/* 1. Tüm Teklifler */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setDropdownVisible(false);
                navigation.navigate('AllProposals');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="documents-outline" size={20} color="#334155" style={{ marginRight: 12 }} />
              <View style={styles.dropdownItemTextContainer}>
                <Text style={styles.dropdownItemTitle}>Tüm Teklifler</Text>
                <Text style={styles.dropdownItemSubtitle}>Kayıtlı teklifler ve detaylı filtreleme</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
            </TouchableOpacity>

            {/* 2. İstatistiklerim */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setDropdownVisible(false);
                navigation.navigate('Statistics');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="bar-chart-outline" size={20} color="#334155" style={{ marginRight: 12 }} />
              <View style={styles.dropdownItemTextContainer}>
                <Text style={styles.dropdownItemTitle}>İstatistiklerim</Text>
                <Text style={styles.dropdownItemSubtitle}>Günlük, haftalık ve aylık analiz</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
            </TouchableOpacity>

            {/* 3. Ekonomi Haberleri */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setDropdownVisible(false);
                navigation.navigate('EconomyNews');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="newspaper-outline" size={20} color="#334155" style={{ marginRight: 12 }} />
              <View style={styles.dropdownItemTextContainer}>
                <Text style={styles.dropdownItemTitle}>Ekonomi Haberleri</Text>
                <Text style={styles.dropdownItemSubtitle}>Canlı piyasa ve ekonomi gündemi</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
            </TouchableOpacity>

            {/* 4. Ayarlar */}
            <TouchableOpacity
              style={styles.dropdownMenuItem}
              onPress={() => {
                setDropdownVisible(false);
                navigation.navigate('Settings');
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={20} color="#334155" style={{ marginRight: 12 }} />
              <View style={styles.dropdownItemTextContainer}>
                <Text style={styles.dropdownItemTitle}>Ayarlar</Text>
                <Text style={styles.dropdownItemSubtitle}>Firma, banka ve KDV ayarları</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>

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
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#107c41'
  },
  topGreenHeader: {
    backgroundColor: '#107c41',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 22,
    paddingBottom: 16,
    paddingHorizontal: 16
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  logoAndTitle: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  logo: {
    width: 60,
    height: 36,
    marginRight: 10
  },
  titleContainer: {
    justifyContent: 'center'
  },
  appTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3
  },
  appSubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '400',
    color: '#d0ebd8',
    marginTop: 1
  },
  headerRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnHeaderNews: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnHeaderSettings: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center'
  },
  ratesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f3f3f3',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18
  },
  ratesCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#107c41'
  },
  ratesCardHeaderTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#555555',
    letterSpacing: 0.3
  },
  ratesValuesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  rateBadgeBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4
  },
  rateBadgeCode: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 11,
    color: '#666666'
  },
  rateBadgeValue: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#111111'
  },
  ratesDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#d8d8d8'
  },
  btnRefreshRates: {
    padding: 2,
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bodyContainer: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 36,
    backgroundColor: '#fafafaff'
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 2
  },
  sectionTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 18,
    color: '#1e293b'
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
    marginTop: 4,
    paddingHorizontal: 2,
    letterSpacing: 0.3
  },
  btnSeeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6
  },
  seeAllText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13,
    color: MS.accent
  },
  btnSeeAllBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.accent,
    paddingVertical: 13,
    marginTop: 10,
    marginBottom: 24,
  },
  btnSeeAllBottomText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13,
    color: MS.accent,
    letterSpacing: 0.3
  },
  emptyContainer: {
    backgroundColor: MS.bg,
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    marginTop: 4
  },
  emptyIllustrationWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    marginTop: 4
  },
  emptyIllustrationLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  emptyIllustrationCenter: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4
  },
  emptyIllustrationRight: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  emptyTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center'
  },
  emptySubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
    marginBottom: 20
  },
  guidePathContainer: {
    width: '100%',
    marginTop: 24,
    paddingHorizontal: 0,
    alignItems: 'flex-start'
  },
  guideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between'
  },
  guideText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12.5,
    color: '#64748b',
    marginRight: 6
  },
  guideHorizontalTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end'
  },
  arrowSegmentH: {
    width: 18,
    height: 4.5,
    backgroundColor: '#107c41',
    borderRadius: 2.5,
    marginRight: 6
  },
  arrowCorner: {
    width: 8,
    height: 8,
    borderTopWidth: 4.5,
    borderRightWidth: 4.5,
    borderTopRightRadius: 4,
    borderColor: '#107c41',
    marginTop: 2,
    marginRight: 12
  },
  guideVerticalCol: {
    width: 28,
    alignSelf: 'flex-end',
    alignItems: 'center',
    marginRight: 0,
    marginTop: 6
  },
  arrowSegmentV: {
    width: 4.5,
    height: 18,
    backgroundColor: '#107c41',
    borderRadius: 2.5,
    marginBottom: 6
  },
  arrowHeadDownBox: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  proposalCard: {
    backgroundColor: '#f3f3f3ff',
    borderTopWidth: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    padding: 14,
    marginBottom: 12,
    borderRadius: 0
  },
  proposalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  proposalClientName: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#111827',
    flex: 1,
    marginRight: 8
  },
  proposalDateText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#6b7280'
  },
  proposalClientYetkili: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2
  },
  proposalCardDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10
  },
  proposalCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  proposalTotalLabel: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#64748b'
  },
  proposalTotalAmount: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#15803d'
  },
  floatingButtonWrapper: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 10
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4
  },
  floatingButtonText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13,
    color: MS.accent,
    letterSpacing: 0.5
  },

  // --- ÖZEL GELİŞMİŞ BOTTOM SHEET AKSİYON MODALI STİLLERİ ---
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
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
    marginBottom: 0,
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 0
  },
  btnSheetCloseText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 14,
    color: MS.textSecondary
  },

  // --- UYGULAMA İÇİ ÖNİZLEME MODALI STİLLERİ ---
  previewContainer: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: MS.borderLight,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  btnPreviewClose: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  btnPreviewCloseText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '500',
    color: MS.textPrimary
  },
  previewTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: MS.textPrimary
  },
  btnPreviewShare: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: MS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  btnPreviewShareText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.accent
  },
  previewWebviewContainer: {
    flex: 1,
    backgroundColor: '#e6e6e6'
  },
  webview: {
    flex: 1,
    backgroundColor: '#e6e6e6'
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
  },

  // --- SAĞ ÜST AÇILIR DROPDOWN MENÜ STİLLERİ ---
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)'
  },
  dropdownMenuCard: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 52 : 62,
    right: 14,
    width: 255,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 25,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  dropdownItemTextContainer: {
    flex: 1
  },
  dropdownItemTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13.5,
    color: '#1e293b'
  },
  dropdownItemSubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  dropdownMenuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
    marginHorizontal: 8
  }
});
