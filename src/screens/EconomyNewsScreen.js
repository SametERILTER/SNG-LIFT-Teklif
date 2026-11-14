import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
  Pressable,
  FlatList,
  Image,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  FadeIn
} from 'react-native-reanimated';
import { MS } from '../constants/theme';
import { useScreenTransition } from '../utils/useScreenTransition';
import { fetchAllEconomyNews, getNewsHourLabel } from '../utils/newsService';
import { fetchLiveRates, getCachedRates } from '../utils/currencyService';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

const STATUSBAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
const COLLAPSE_AMOUNT = 46;
const HEADER_HEIGHT = STATUSBAR_H + 98;
const SCROLL_DISTANCE = 110;

// Klavye kapanmasını önlemek için memoize edilmiş arama başlığı
const NewsSearchHeader = React.memo(function NewsSearchHeader({ searchQuery, setSearchQuery, rates }) {
  return (
    <View style={styles.listHeaderContainer}>
      {/* 1. Arama Kutusu */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={17} color="#64748b" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Haberlerde ara..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={17} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* 2. Dolar ve Euro Kurları Kartları */}
      <View style={styles.ratesRow}>
        {/* Dolar (USD) */}
        <View style={styles.rateCard}>
          <View style={styles.rateCardTop}>
            <View style={styles.rateIconCircle}>
              <Ionicons name="logo-usd" size={12} color="#107c41" />
            </View>
            <Text style={styles.rateCardCode}>Dolar / USD</Text>
          </View>
          <Text style={styles.rateCardValue}>
            {rates?.usd ? `${rates.usd} ₺` : '...'}
          </Text>
        </View>

        {/* Euro (EUR) */}
        <View style={styles.rateCard}>
          <View style={styles.rateCardTop}>
            <View style={styles.rateIconCircle}>
              <Ionicons name="logo-euro" size={12} color="#107c41" />
            </View>
            <Text style={styles.rateCardCode}>Euro / EUR</Text>
          </View>
          <Text style={styles.rateCardValue}>
            {rates?.eur ? `${rates.eur} ₺` : '...'}
          </Text>
        </View>
      </View>
    </View>
  );
});

export default function EconomyNewsScreen({ navigation }) {
  const { animatedStyle, handleGoBack } = useScreenTransition(navigation);
  const [news, setNews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [rates, setRates] = useState({ usd: null, eur: null, loading: true });
  const [failedImages, setFailedImages] = useState(new Set());

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

  // Ana Sayfa (Geri) butonu basma animasyonu
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

  // --- SCROLL KAYDIRMAYA BAĞLI DİNAMİK HEADER ANİMASYONLARI (100% GPU TRANSFORM) ---
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

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

  // Haberleri Yükle
  const loadNews = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
      fetchRates();
    } else {
      setIsLoading(true);
    }

    try {
      const data = await fetchAllEconomyNews();
      setNews(data);
    } catch (e) {
      console.log('Haberler alınamadı:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchRates]);

  useEffect(() => {
    // 1. Önce önbellekteki kurları hemen yükle
    getCachedRates().then((cached) => {
      if (cached && cached.usd && cached.eur) {
        setRates((prev) => ({ ...prev, usd: cached.usd, eur: cached.eur }));
      }
    });
    // 2. Canlı verileri çek
    loadNews();
    fetchRates();
  }, [loadNews, fetchRates]);

  // Arama Filtresi
  const filteredNews = useMemo(() => {
    let list = [...news];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    }

    return list;
  }, [news, searchQuery]);

  // Saatlik / Zaman Gruplu Haberler (En yeni saatler en üstte)
  const groupedNews = useMemo(() => {
    const groups = [];
    const map = new Map();

    for (const item of filteredNews) {
      const label = getNewsHourLabel(item.pubDate);
      if (!map.has(label)) {
        const groupObj = {
          timeLabel: label,
          items: []
        };
        map.set(label, groupObj);
        groups.push(groupObj);
      }
      map.get(label).items.push(item);
    }

    return groups;
  }, [filteredNews]);

  const handleOpenDetail = (item) => {
    navigation.navigate('NewsDetail', { newsItem: item });
  };

  const handleImageError = (id) => {
    setFailedImages(prev => new Set(prev).add(id));
  };

  const renderTimeGroup = ({ item: group, index: groupIdx }) => {
    return (
      <View style={styles.timeGroupContainer}>
        {/* Sol Üst Saat / Zaman Başlığı */}
        <View style={styles.timeGroupHeaderRow}>
          <View style={styles.timeClockIconBox}>
            <Ionicons name="time-outline" size={16} color="#64748b" />
          </View>
          <Text style={styles.timeGroupTitle}>{group.timeLabel}</Text>
          <View style={styles.timeGroupLine} />
          <Text style={styles.timeGroupCount}>{group.items.length} Haber</Text>
        </View>

        {/* O Saate Ait Haber Kartları */}
        {group.items.map((newsItem, itemIdx) => {
          const hasValidImage = newsItem.imageUrl && !failedImages.has(newsItem.id);
          const globalIdx = groupIdx * 3 + itemIdx;

          return (
            <Animated.View
              key={newsItem.id || newsItem.link}
              entering={FadeIn.duration(220).delay(globalIdx < 6 ? globalIdx * 35 : 0)}
            >
              <TouchableOpacity
                style={styles.newsCard}
                onPress={() => handleOpenDetail(newsItem)}
                activeOpacity={0.75}
              >
                {/* Haber Görseli */}
                {hasValidImage ? (
                  <View style={styles.imageContainer}>
                    <Image
                      source={{ uri: newsItem.imageUrl }}
                      style={styles.newsImage}
                      resizeMode="cover"
                      onError={() => handleImageError(newsItem.id)}
                    />
                  </View>
                ) : null}

                {/* Kart Metin İçeriği */}
                <View style={styles.cardContent}>
                  <Text style={styles.newsTitle} numberOfLines={3}>
                    {newsItem.title}
                  </Text>

                  {newsItem.description ? (
                    <Text style={styles.newsDesc} numberOfLines={2}>
                      {newsItem.description.replace(/<!\[CDATA\[|\]\]>/gi, '').trim()}
                    </Text>
                  ) : null}

                  {/* Alttaki Hafif Gri Kaynak Bilgisi */}
                  <View style={styles.cardFooterRow}>
                    <Text style={styles.sourceText} numberOfLines={1}>
                      Kaynak: <Text style={styles.sourceNameHighlight}>{newsItem.source}</Text>
                      {newsItem.timeAgo ? ` • ${newsItem.timeAgo}` : ''}
                    </Text>

                    <View style={styles.readActionBox}>
                      <Text style={styles.readMoreText}>Haberi Oku</Text>
                      <Ionicons name="chevron-forward" size={13} color="#107c41" />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#107c41" />
          <Text style={styles.loadingText}>Ekonomi haberleri yükleniyor...</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="newspaper-outline" size={48} color="#cbd5e1" style={{ marginBottom: 12 }} />
        <Text style={styles.emptyTitle}>Haber Bulunamadı</Text>
        <Text style={styles.emptySubtitle}>
          Aradığınız kriterlere uygun güncel ekonomi haberi bulunamadı veya bağlantı sağlanamadı.
        </Text>
        <TouchableOpacity style={styles.btnRetry} onPress={() => loadNews()} activeOpacity={0.75}>
          <Ionicons name="refresh" size={15} color="#107c41" style={{ marginRight: 6 }} />
          <Text style={styles.btnRetryText}>Yeniden Dene</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* 1. ÜST YEŞİL KURUMSAL BAŞLIK BARI (GPU HIZLANDIRMALI DİNAMİK HEADER) */}
      <Animated.View style={[styles.topGreenHeader, headerAnimatedStyle]}>
        <SafeAreaView>
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

              <View style={styles.headerTitleSwapContainer}>
                {/* 1. Geniş Halde: "Ana Sayfa" */}
                <Animated.View style={[styles.titleSwapItem, backTextAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.btnBackText} numberOfLines={1}>Ana Sayfa</Text>
                </Animated.View>

                {/* 2. Scroll Edilince: "Ekonomi Haberleri" */}
                <Animated.View style={[styles.titleSwapItem, smallTitleAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.smallHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">
                    Ekonomi Haberleri
                  </Text>
                </Animated.View>
              </View>
            </View>

            {/* Sağ Üst: Yenile Butonu */}
            <View style={styles.topHeaderRightActions}>
              <TouchableOpacity
                onPress={() => loadNews(true)}
                style={styles.btnRefreshHeader}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh" size={15} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Alt Satır: Büyük Başlık */}
          <Animated.View style={[styles.titleRowContainer, titleRowAnimatedStyle]}>
            <Text style={styles.pageHeaderTitle} numberOfLines={1}>Ekonomi Haberleri</Text>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>

      {/* 2. HABER LİSTESİ (SAATLİK ZAMAN GRUPLARI İLE) */}
      <AnimatedFlatList
        data={groupedNews}
        keyExtractor={(item) => item.timeLabel}
        renderItem={renderTimeGroup}
        ListHeaderComponent={
          <NewsSearchHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            rates={rates}
          />
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadNews(true)}
            colors={['#107c41']}
            tintColor="#107c41"
            progressViewOffset={HEADER_HEIGHT}
          />
        }
      />
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
    alignItems: 'center'
  },
  btnRefreshHeader: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 0
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

  scrollView: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: HEADER_HEIGHT + 8,
    paddingBottom: 36,
    backgroundColor: '#f5f5f5ff'
  },

  listHeaderContainer: {
    marginBottom: 12
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6
  },
  searchInput: {
    flex: 1,
    fontFamily: MS.fontFamily,
    fontSize: 13.5,
    color: '#1e293b',
    padding: 0
  },

  ratesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10
  },
  rateCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    paddingHorizontal: 12,
    paddingVertical: 9
  },
  rateCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6
  },
  rateIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rateCardCode: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11.5,
    color: '#666666'
  },
  rateCardValue: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15.5,
    color: '#111111',
    letterSpacing: 0.2
  },

  // Saatlik Zaman Grupları Stilleri
  timeGroupContainer: {
    marginBottom: 12
  },
  timeGroupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8
  },
  timeClockIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  timeGroupTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 19,
    color: '#0f172a',
    letterSpacing: 0.1
  },
  timeGroupLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 10
  },
  timeGroupCount: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#94a3b8'
  },

  // Haber Kartı Stilleri (Düz, kenarlıksız, modern ve hafif ayrılmış)
  newsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    marginBottom: 12,
    overflow: 'hidden'
  },
  imageContainer: {
    width: '100%',
    height: 195,
    backgroundColor: '#f1f5f9'
  },
  newsImage: {
    width: '100%',
    height: '100%'
  },
  cardContent: {
    padding: 13
  },
  newsTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14.5,
    color: '#0f172a',
    lineHeight: 21,
    marginBottom: 16
  },
  newsDesc: {
    fontFamily: MS.fontFamily,
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 25
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  sourceText: {
    fontFamily: MS.fontFamily,
    fontSize: 11.5,
    color: '#94a3b8',
    flex: 1,
    marginRight: 6
  },
  sourceNameHighlight: {
    fontFamily: MS.fontFamilyMedium,
    color: '#64748b'
  },
  readActionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  readMoreText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 11.5,
    color: '#107c41'
  },

  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 13,
    color: '#64748b',
    marginTop: 12
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10
  },
  emptyTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 6
  },
  emptySubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 280,
    marginBottom: 16
  },
  btnRetry: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#eef8f1',
    borderWidth: 1,
    borderColor: '#107c41'
  },
  btnRetryText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41'
  }
});
