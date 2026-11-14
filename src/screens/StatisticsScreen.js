import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  Platform,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
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
import { useScreenTransition } from '../utils/useScreenTransition';
import AnimatedCounter from '../components/AnimatedCounter';
import AnimatedProgressBar from '../components/AnimatedProgressBar';
import { StatisticsSkeleton } from '../components/SkeletonLoader';

const STATUSBAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
const COLLAPSE_AMOUNT = 46;
const HEADER_HEIGHT = STATUSBAR_H + 98;
const SCROLL_DISTANCE = 110;

// Tarih ayrıştırıcı (DD.MM.YYYY veya timestamp)
function parseProposalDate(tarihStr, id) {
  if (tarihStr && typeof tarihStr === 'string' && tarihStr.includes('.')) {
    const parts = tarihStr.split('.');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
  }
  if (id) {
    const num = parseInt(id, 10);
    if (!isNaN(num) && num > 1000000000) {
      const d = new Date(num);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date();
}

const formatCurrency = (val, currency = 'USD') => {
  const sym = currency === 'TL' ? '₺' : currency === 'EUR' ? '€' : '$';
  return `${sym} ${Number(val || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export default function StatisticsScreen({ navigation }) {
  const { animatedStyle, handleGoBack } = useScreenTransition(navigation);

  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activePeriod, setActivePeriod] = useState('monthly'); // 'daily' | 'weekly' | 'monthly' | 'all'

  // Sol Üst Geri Butonu Basma Animasyonu (Yaylanmasız)
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

  // 3. Büyük "İstatistiklerim" başlığının süzülerek kaybolması
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

  // 4. "Ana Sayfa" yazısının pürüzsüzce kaybolması (GPU Opacity)
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

  // 5. Küçük "İstatistiklerim" başlığının yumuşakça belirmesi (GPU Opacity & Transform)
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

  // Teklifleri Yükle
  useEffect(() => {
    const loadData = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setProposals(JSON.parse(stored));
        } else {
          setProposals([]);
        }
      } catch (e) {
        console.log('İstatistikler yüklenemedi:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Seçili Döneme Göre Filtrelenmiş Teklifler
  const filteredProposals = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);

    return proposals.filter((prop) => {
      const propDate = parseProposalDate(prop.tarih, prop.id);
      if (activePeriod === 'daily') {
        return propDate >= todayStart && propDate <= todayEnd;
      }
      if (activePeriod === 'weekly') {
        return propDate >= weekStart && propDate <= todayEnd;
      }
      if (activePeriod === 'monthly') {
        return propDate >= monthStart && propDate <= todayEnd;
      }
      return true; // 'all'
    });
  }, [proposals, activePeriod]);

  // İstatistiksel Hesaplamalar
  const stats = useMemo(() => {
    let totalUsd = 0;
    let totalTl = 0;
    let totalEur = 0;
    let totalMotorCount = 0;
    let maxProposal = null;

    const clientMap = {};
    const motorMap = {};

    filteredProposals.forEach((prop) => {
      const cur = prop.currency || prop.payload?.currency || 'USD';
      const amount = parseFloat(prop.grandTotal || prop.payload?.grandTotal || 0);

      if (cur === 'TL') totalTl += amount;
      else if (cur === 'EUR') totalEur += amount;
      else totalUsd += amount;

      // En yüksek tutarlı teklifi tespit et
      if (!maxProposal || amount > (maxProposal.amount || 0)) {
        maxProposal = {
          firma: prop.firma || prop.payload?.clientFirma || 'Müşteri Belirtilmedi',
          amount: amount,
          currency: cur,
          tarih: prop.tarih || '-'
        };
      }

      // Müşteri frekansı
      const clientName = (prop.firma || prop.payload?.clientFirma || 'Müşteri Belirtilmedi').trim();
      if (!clientMap[clientName]) {
        clientMap[clientName] = { count: 0, total: 0, currency: cur };
      }
      clientMap[clientName].count += 1;
      clientMap[clientName].total += amount;

      // Kalem & Motor adetleri
      const items = prop.payload?.items || [];
      items.forEach((item) => {
        const modelName = item.model || 'Standart Motor';
        const qty = parseInt(item.adet || 1, 10);
        totalMotorCount += qty;
        motorMap[modelName] = (motorMap[modelName] || 0) + qty;
      });
      if (items.length === 0) {
        totalMotorCount += 1;
      }
    });

    const topClients = Object.entries(clientMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topMotors = Object.entries(motorMap)
      .map(([model, count]) => ({ model, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const totalCount = filteredProposals.length;

    return {
      totalCount,
      totalUsd,
      totalTl,
      totalEur,
      totalMotorCount,
      maxProposal,
      topClients,
      topMotors
    };
  }, [filteredProposals]);

  const periodBigTitles = {
    daily: 'BUGÜN',
    weekly: 'BU HAFTA',
    monthly: 'BU AY',
    all: 'TÜM ZAMANLAR'
  };

  const periodSubtitles = {
    daily: 'Bugün hazırlanan tekliflerin özet raporu',
    weekly: 'Son 7 günün toplam teklif analizi',
    monthly: 'İçinde bulunulan cari ayın teklif analizi',
    all: 'Kayıtlı tüm tekliflerin genel performans raporu'
  };

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* 1. ÜST YEŞİL KURUMSAL BAŞLIK BARI (GPU HIZLANDIRMALI 0-LAG DİNAMİK HEADER) */}
      <Animated.View style={[styles.topGreenHeader, headerAnimatedStyle]}>
        <SafeAreaView>
          {/* Üst Satır: (Geri Butonu + Yanındaki Dinamik Başlık) + (Teklif Sayısı Rozeti) */}
          <Animated.View style={[styles.topNavHeaderRow, navRowAnimatedStyle]}>
            <View style={styles.topHeaderLeftBox}>
              <Pressable
                onPress={handleGoBack}
                onPressIn={handleBackPressIn}
                onPressOut={handleBackPressOut}
              >
                <Animated.View style={[styles.btnBack, backAnimatedStyle]}>
                  <Ionicons name="arrow-back" size={17} color="#ffffff" />
                </Animated.View>
              </Pressable>

              {/* Dinamik Başlık Alanı (Ana Sayfa -> İstatistiklerim Crossfade) */}
              <View style={styles.headerTitleSwapContainer}>
                {/* 1. Scroll Edilmemişken: "Ana Sayfa" */}
                <Animated.View style={[styles.titleSwapItem, backTextAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.btnBackText} numberOfLines={1}>Ana Sayfa</Text>
                </Animated.View>

                {/* 2. Scroll Edilince: "İstatistiklerim" */}
                <Animated.View style={[styles.titleSwapItem, smallTitleAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.smallHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">
                    İstatistiklerim
                  </Text>
                </Animated.View>
              </View>
            </View>

            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{stats.totalCount} Teklif</Text>
            </View>
          </Animated.View>

          {/* Alt Satır: "İstatistiklerim" (Scroll ile yukarı doğru süzülerek kaybolur) */}
          <Animated.View style={[styles.titleRowContainer, titleRowAnimatedStyle]}>
            <Text style={styles.pageHeaderTitle} numberOfLines={1}>İstatistiklerim</Text>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>

      {/* 2. İSTATİSTİK İÇERİK BÖLÜMÜ */}
      <View style={styles.bodyContainer}>
        <Animated.ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 14 }]}
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
        >
          {/* DÖNEM SEÇİCİ KÖŞELİ TAB ÇUBUĞU */}
          <View style={styles.periodSelectorWrapper}>
            <View style={styles.periodSelectorContainer}>
              {[
                { key: 'daily', label: 'BUGÜN' },
                { key: 'weekly', label: 'BU HAFTA' },
                { key: 'monthly', label: 'BU AY' },
                { key: 'all', label: 'TÜMÜ' }
              ].map((item) => {
                const isActive = activePeriod === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setActivePeriod(item.key)}
                    style={[styles.periodTab, isActive && styles.periodTabActive]}
                  >
                    <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {isLoading ? (
            <StatisticsSkeleton />
          ) : (
            <>
              {/* BÜYÜK DÖNEM BAŞLIĞI & TEKLİF SAYISI (KUTUSUZ) */}
              <View style={styles.periodHeaderContainer}>
                <Text style={styles.bigPeriodTitle}>{periodBigTitles[activePeriod]}</Text>
                <AnimatedCounter
                  value={stats.totalCount}
                  isInteger={true}
                  suffix=" TEKLİF"
                  style={styles.bigPeriodCount}
                />
                <Text style={styles.bigPeriodSubtitle}>{periodSubtitles[activePeriod]}</Text>
              </View>

              {/* ANA TOPLAM HACİM KARTI (KÖŞELİ) */}
              <Animated.View
                entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic))}
                style={styles.mainVolumeCard}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardHeaderLabel}>TOPLAM TEKLİF TUTARI</Text>
                  <View style={styles.countBadge}>
                    <AnimatedCounter
                      value={stats.totalCount}
                      isInteger={true}
                      suffix=" TEKLİF"
                      style={styles.countBadgeText}
                    />
                  </View>
                </View>

                <View style={styles.volumeAmountsGrid}>
                  <View style={styles.volumeAmountItem}>
                    <Text style={styles.volumeCurrencyLabel}>USD TOPLAMI</Text>
                    <AnimatedCounter
                      value={stats.totalUsd}
                      currency="USD"
                      style={styles.volumeValueUsd}
                    />
                  </View>

                  {stats.totalTl > 0 && (
                    <View style={styles.volumeAmountItem}>
                      <Text style={styles.volumeCurrencyLabel}>TL TOPLAMI</Text>
                      <AnimatedCounter
                        value={stats.totalTl}
                        currency="TL"
                        style={styles.volumeValueTl}
                      />
                    </View>
                  )}

                  {stats.totalEur > 0 && (
                    <View style={styles.volumeAmountItem}>
                      <Text style={styles.volumeCurrencyLabel}>EUR TOPLAMI</Text>
                      <AnimatedCounter
                        value={stats.totalEur}
                        currency="EUR"
                        style={styles.volumeValueEur}
                      />
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* 2'Lİ ÖZET BİLGİ KARTLARI (KÖŞELİ) */}
              <View style={styles.metricsRow}>
                {/* Toplam Teklif Sayısı */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardTop}>
                    <Ionicons name="document-text" size={18} color="#107c41" />
                    <Text style={styles.metricTitle}>TEKLİF ADEDİ</Text>
                  </View>
                  <AnimatedCounter
                    value={stats.totalCount}
                    isInteger={true}
                    style={styles.metricNumber}
                  />
                  <Text style={styles.metricFootnote}>Kayıtlı Teklif</Text>
                </View>

                {/* Toplam Motor / Malzeme Sayısı */}
                <View style={styles.metricCard}>
                  <View style={styles.metricCardTop}>
                    <Ionicons name="hardware-chip" size={18} color="#0078d4" />
                    <Text style={styles.metricTitle}>TOPLAM MOTOR</Text>
                  </View>
                  <AnimatedCounter
                    value={stats.totalMotorCount}
                    isInteger={true}
                    style={styles.metricNumber}
                  />
                  <Text style={styles.metricFootnote}>Adet Motor / Ekipman</Text>
                </View>
              </View>

              {/* DÖNEMİN EN YÜKSEK TEKLİFİ (KÖŞELİ) */}
              {stats.maxProposal && (
                <View style={styles.highlightCard}>
                  <View style={styles.highlightHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons name="trophy" size={16} color="#d97706" style={{ marginRight: 6 }} />
                      <Text style={styles.highlightHeaderTitle}>DÖNEMİN EN YÜKSEK TEKLİFİ</Text>
                    </View>
                    <Text style={styles.highlightDateText}>{stats.maxProposal.tarih}</Text>
                  </View>
                  <View style={styles.highlightBody}>
                    <Text style={styles.highlightClientName} numberOfLines={1}>
                      {stats.maxProposal.firma}
                    </Text>
                    <AnimatedCounter
                      value={stats.maxProposal.amount}
                      currency={stats.maxProposal.currency}
                      style={styles.highlightAmount}
                    />
                  </View>
                </View>
              )}

              {/* EN ÇOK TEKLİF VERİLEN MÜŞTERİLER (KÖŞELİ) */}
              <View style={styles.blockContainer}>
                <View style={styles.blockHeaderRow}>
                  <Text style={styles.blockTitle}>EN ÇOK TEKLİF VERİLEN MÜŞTERİLER</Text>
                  <Text style={styles.blockSubtitle}>Sıralama</Text>
                </View>

                {stats.topClients.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Bu dönemde müşteri kaydı bulunmuyor.</Text>
                  </View>
                ) : (
                  stats.topClients.map((client, idx) => (
                    <View key={client.name + idx} style={styles.clientItemRow}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.clientNameText} numberOfLines={1}>
                          {client.name}
                        </Text>
                        <AnimatedCounter
                          value={client.count}
                          isInteger={true}
                          suffix=" Adet Teklif"
                          style={styles.clientCountText}
                        />
                      </View>
                      <AnimatedCounter
                        value={client.total}
                        currency={client.currency}
                        style={styles.clientTotalAmount}
                      />
                    </View>
                  ))
                )}
              </View>

              {/* EN ÇOK TERCİH EDİLEN MOTOR MODELLERİ (KÖŞELİ) */}
              <View style={styles.blockContainer}>
                <View style={styles.blockHeaderRow}>
                  <Text style={styles.blockTitle}>EN ÇOK TERCİH EDİLEN MOTOR MODELLERİ</Text>
                </View>

                {stats.topMotors.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Bu dönemde motor verisi bulunmuyor.</Text>
                  </View>
                ) : (
                  stats.topMotors.map((m, idx) => {
                    const maxCount = stats.topMotors[0]?.count || 1;
                    const ratio = Math.max(10, Math.min(100, (m.count / maxCount) * 100));
                    return (
                      <View key={m.model + idx} style={styles.motorItemRow}>
                        <View style={styles.motorItemTop}>
                          <Text style={styles.motorModelText}>{m.model}</Text>
                          <AnimatedCounter
                            value={m.count}
                            isInteger={true}
                            suffix=" Adet"
                            style={styles.motorCountText}
                          />
                        </View>
                        <AnimatedProgressBar
                          ratio={ratio}
                          index={idx}
                          barColor="#107c41"
                          height={8}
                        />
                      </View>
                    );
                  })
                )}
              </View>

              {/* DÖNEMİN TEKLİFLERİ (ÖZET LİSTE) */}
              {filteredProposals.length > 0 && (
                <View style={styles.blockContainer}>
                  <View style={styles.blockHeaderRow}>
                    <Text style={styles.blockTitle}>DÖNEM TEKLİFLERİ LİSTESİ</Text>
                    <Text style={styles.blockSubtitle}>{filteredProposals.length} Kayıt</Text>
                  </View>

                  {filteredProposals.slice(0, 5).map((prop) => (
                    <View key={prop.id} style={styles.recentProposalItem}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.recentFirmaText} numberOfLines={1}>
                          {prop.firma || 'Müşteri Belirtilmedi'}
                        </Text>
                        <Text style={styles.recentDateText}>{prop.tarih}</Text>
                      </View>
                      <Text style={styles.recentAmountText}>
                        {formatCurrency(prop.grandTotal, prop.currency || prop.payload?.currency)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ALT KONFORLU BOŞLUK */}
          <View style={{ height: 80 }} />
        </Animated.ScrollView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#107c41'
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
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff'
  },
  smallHeaderTitleText: {
    fontFamily: MS.fontFamily,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.1
  },
  headerBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 0
  },
  headerBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#ffffff',
    letterSpacing: 0.3
  },
  titleRowContainer: {
    justifyContent: 'center',
    marginTop: 2,
    overflow: 'hidden'
  },
  pageHeaderTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2
  },

  // Dönem Seçici (Köşeli)
  periodSelectorWrapper: {
    marginBottom: 16
  },
  periodSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 0
  },
  periodTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0'
  },
  periodTabActive: {
    backgroundColor: '#107c41'
  },
  periodTabText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.4
  },
  periodTabTextActive: {
    color: '#ffffff'
  },

  // İçerik Alanı
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
    paddingTop: 16,
    paddingBottom: 40,
    backgroundColor: '#fafafaff'
  },

  // Büyük Dönem Başlığı & Teklif Sayısı (Kutusuz, Beyaz Zemin)
  periodHeaderContainer: {
    paddingTop: 4,
    paddingBottom: 16,
    marginBottom: 16,
  },
  bigPeriodTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 25,
    color: '#424242ff',
  },
  bigPeriodCount: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 26,
    color: '#107c41',
    marginTop: 3,
    letterSpacing: 0.2
  },
  bigPeriodSubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#64748b',
    marginTop: 3
  },

  // Ana Hacim Kartı (Köşeli)
  mainVolumeCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#107c41',
    borderRadius: 0,
    padding: 16,
    marginBottom: 14
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8
  },
  cardHeaderLabel: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41',
    letterSpacing: 0.5
  },
  countBadge: {
    backgroundColor: '#eef8f1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 0
  },
  countBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 10,
    color: '#107c41'
  },
  volumeAmountsGrid: {
    gap: 10
  },
  volumeAmountItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4
  },
  volumeCurrencyLabel: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#64748b'
  },
  volumeValueUsd: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 18,
    color: '#107c41'
  },
  volumeValueTl: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 18,
    color: '#0078d4'
  },
  volumeValueEur: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 18,
    color: '#7c3aed'
  },

  // 2'li Metrik Kartları (Köşeli)
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0,
    padding: 14
  },
  metricCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8
  },
  metricTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.3
  },
  metricNumber: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 22,
    color: '#0f172a',
    marginBottom: 2
  },
  metricFootnote: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#64748b'
  },

  // Rekor Teklif Kartı (Köşeli)
  highlightCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 0,
    padding: 14,
    marginBottom: 14
  },
  highlightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  highlightHeaderTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#b45309',
    letterSpacing: 0.4
  },
  highlightDateText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#92400e'
  },
  highlightBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  highlightClientName: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14,
    color: '#78350f',
    flex: 1,
    marginRight: 10
  },
  highlightAmount: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#b45309'
  },

  // Blok Konteynerler (Köşeli)
  blockContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0,
    padding: 14,
    marginBottom: 14
  },
  blockHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8
  },
  blockTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#1e293b',
    letterSpacing: 0.4
  },
  blockSubtitle: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11,
    color: '#64748b'
  },
  emptyBox: {
    paddingVertical: 14,
    alignItems: 'center'
  },
  emptyText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#94a3b8'
  },

  // Müşteri Satırı (Köşeli)
  clientItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  clientIndexBadge: {
    width: 26,
    height: 26,
    backgroundColor: '#f1f5f9',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  clientIndexText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#475569'
  },
  clientNameText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#1e293b'
  },
  clientCountText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  clientTotalAmount: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#107c41'
  },

  // Motor Satırı (Köşeli)
  motorItemRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  motorItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  motorModelText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#1e293b'
  },
  motorCountText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#0078d4'
  },
  progressTrackSquare: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 0,
    overflow: 'hidden'
  },
  progressFillSquare: {
    height: '100%',
    backgroundColor: '#0078d4',
    borderRadius: 0
  },

  // Son Teklifler
  recentProposalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  recentFirmaText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#1e293b'
  },
  recentDateText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  recentAmountText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#107c41'
  }
});
