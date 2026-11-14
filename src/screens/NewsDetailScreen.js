import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Pressable,
  Share,
  Linking,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn
} from 'react-native-reanimated';
import { MS } from '../constants/theme';
import { useScreenTransition } from '../utils/useScreenTransition';
import { fetchFullArticle } from '../utils/newsService';

export default function NewsDetailScreen({ route, navigation }) {
  const { newsItem } = route.params || {};
  const { animatedStyle, handleGoBack } = useScreenTransition(navigation);

  const [isLoadingArticle, setIsLoadingArticle] = useState(true);
  const [articleData, setArticleData] = useState(null);
  const [imageError, setImageError] = useState(false);

  // Geri butonu basma animasyonu
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

  // Tam haber metnini çek
  const loadFullArticle = useCallback(async () => {
    if (!newsItem?.link) {
      setIsLoadingArticle(false);
      return;
    }

    setIsLoadingArticle(true);
    try {
      const data = await fetchFullArticle(newsItem.link);
      setArticleData(data);
    } catch (e) {
      console.log('Haber detayı çekilemedi:', e);
    } finally {
      setIsLoadingArticle(false);
    }
  }, [newsItem?.link]);

  useEffect(() => {
    loadFullArticle();
  }, [loadFullArticle]);

  const handleShare = async () => {
    if (!newsItem) return;
    try {
      await Share.share({
        message: `${newsItem.title}\n\nKaynak: ${newsItem.source}\n${newsItem.link}`,
        url: newsItem.link,
        title: newsItem.title
      });
    } catch (e) {
      // ignore
    }
  };

  const handleOpenBrowser = async () => {
    if (!newsItem?.link) return;
    try {
      const canOpen = await Linking.canOpenURL(newsItem.link);
      if (canOpen) {
        await Linking.openURL(newsItem.link);
      }
    } catch (e) {
      console.log('Tarayıcı açılamadı:', e);
    }
  };

  if (!newsItem) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Haber bulunamadı.</Text>
        <TouchableOpacity style={styles.btnBackFallback} onPress={() => navigation.goBack()}>
          <Text style={styles.btnBackFallbackText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Görsel önceliği: Scraper hero image -> RSS image
  const displayImage = (!imageError && (articleData?.heroImage || newsItem.imageUrl)) || null;

  // Paragraf listesi: Scraped paragraphs veya RSS description
  const paragraphs = (articleData?.paragraphs && articleData.paragraphs.length > 0)
    ? articleData.paragraphs
    : (newsItem.description ? [newsItem.description] : []);

  // Lead / Spot özeti
  const leadSummary = articleData?.lead || (newsItem.description !== paragraphs[0] ? newsItem.description : '');

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* 1. ÜST YEŞİL BAŞLIK BARI */}
      <View style={styles.topGreenHeader}>
        <SafeAreaView>
          <View style={styles.topNavHeaderRow}>
            {/* Sol: Geri Butonu + Kaynak Başlığı */}
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

              <View style={styles.headerTitleBox}>
                <Text style={styles.headerSourceTitle} numberOfLines={1}>
                  {newsItem.source || 'Ekonomi Haberi'}
                </Text>
                {newsItem.timeAgo ? (
                  <Text style={styles.headerTimeSubtitle} numberOfLines={1}>
                    {newsItem.timeAgo}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Sağ: Tarayıcıda Aç ve Paylaş Butonları */}
            <View style={styles.topHeaderRightActions}>
              <TouchableOpacity
                onPress={handleOpenBrowser}
                style={styles.btnActionHeader}
                activeOpacity={0.65}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 6 }}
              >
                <Ionicons name="globe-outline" size={19} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShare}
                style={styles.btnActionHeader}
                activeOpacity={0.65}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
              >
                <Ionicons name="share-social-outline" size={19} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* 2. HABER İÇERİĞİ (OKUMA MODU) */}
      <ScrollView
        style={styles.contentScrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(250)}>
          {/* Ana Başlık */}
          <Text style={styles.articleHeadline}>
            {newsItem.title}
          </Text>

          {/* Kaynak & Tarih Satırı (Başlığın Altında) */}
          <View style={styles.metaRow}>
            <Text style={styles.metaSourceAndDate}>
              Kaynak: <Text style={styles.metaSourceBold}>{newsItem.source}</Text>
              {(newsItem.fullDate || newsItem.timeAgo) ? ` • ${newsItem.fullDate || newsItem.timeAgo}` : ''}
            </Text>
          </View>

          {/* Kapak Görseli */}
          {displayImage ? (
            <View style={styles.heroImageContainer}>
              <Image
                source={{ uri: displayImage }}
                style={styles.heroImage}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            </View>
          ) : null}

          {/* Yükleniyor Durumu (Arka planda tam metin çekilirken) */}
          {isLoadingArticle && (
            <View style={styles.loadingInlineBox}>
              <ActivityIndicator size="small" color="#107c41" />
              <Text style={styles.loadingInlineText}>Haberin tamamı yükleniyor...</Text>
            </View>
          )}

          {/* Spot / Özet Metni */}
          {leadSummary ? (
            <Text style={styles.leadText}>
              {leadSummary}
            </Text>
          ) : null}

          {/* Paragraflar ve Ara Başlıklar (Tam Metin) */}
          <View style={styles.paragraphsContainer}>
            {paragraphs.map((item, idx) => {
              const isHeading = typeof item === 'object' && item.type === 'heading';
              const textContent = typeof item === 'object' ? item.text : item;

              if (isHeading) {
                return (
                  <Text key={`h-${idx}`} style={styles.subHeadingText}>
                    {textContent}
                  </Text>
                );
              }

              return (
                <Text key={`p-${idx}`} style={styles.paragraphText}>
                  {textContent}
                </Text>
              );
            })}
          </View>

          {/* Alt Bilgi & Orijinal Kaynak Alanı */}
          <View style={styles.footerContainer}>
            <View style={styles.footerDivider} />

            <Text style={styles.footerSourceText}>
              Kaynak: <Text style={styles.footerSourceBold}>{newsItem.source}</Text>
            </Text>

            {/* Butonlar */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.btnActionBrowser}
                onPress={handleOpenBrowser}
                activeOpacity={0.8}
              >
                <Ionicons name="open-outline" size={15} color="#107c41" style={{ marginRight: 6 }} />
                <Text style={styles.btnActionBrowserText}>Orijinal Haberi Aç</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnActionShare}
                onPress={handleShare}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.btnActionShareText}>Paylaş</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#107c41'
  },
  topGreenHeader: {
    backgroundColor: '#107c41',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 8 : 12,
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  topNavHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 36
  },
  topHeaderLeftBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
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
  headerTitleBox: {
    marginLeft: 10,
    flex: 1
  },
  headerSourceTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14,
    color: '#ffffff'
  },
  headerTimeSubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#d0ebd8',
    marginTop: 1
  },
  topHeaderRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnActionHeader: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent'
  },

  contentScrollView: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 88
  },

  articleHeadline: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 25,
    color: '#090d16',
    lineHeight: 31,
    letterSpacing: 0.1,
    marginBottom: 10,
    marginTop: 12
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18
  },
  metaSourceAndDate: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#94a3b8'
  },
  metaSourceBold: {
    fontFamily: MS.fontFamilyMedium,
    color: '#64748b'
  },

  heroImageContainer: {
    width: '100%',
    height: 215,
    backgroundColor: '#f1f5f9',
    marginTop: 8,
    marginBottom: 22,
    overflow: 'hidden'
  },
  heroImage: {
    width: '100%',
    height: '100%'
  },

  loadingInlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 16,
    gap: 8
  },
  loadingInlineText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12.5,
    color: '#166534'
  },

  leadText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15.5,
    color: '#0f172a',
    lineHeight: 24,
    marginBottom: 16
  },

  paragraphsContainer: {
    marginBottom: 24
  },
  subHeadingText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 17,
    color: '#0f172a',
    lineHeight: 25,
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: 0.1
  },
  paragraphText: {
    fontFamily: MS.fontFamily,
    fontSize: 15.5,
    color: '#1e293b',
    lineHeight: 26,
    marginBottom: 16
  },

  footerContainer: {
    marginTop: 10
  },
  footerDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16
  },
  footerSourceText: {
    fontFamily: MS.fontFamily,
    fontSize: 12.5,
    color: '#94a3b8',
    marginBottom: 16
  },
  footerSourceBold: {
    fontFamily: MS.fontFamilyMedium,
    color: '#64748b'
  },

  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  btnActionBrowser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#107c41'
  },
  btnActionBrowserText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#107c41'
  },
  btnActionShare: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    backgroundColor: '#107c41'
  },
  btnActionShareText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#ffffff'
  },

  errorContainer: {
    flex: 1,
    backgroundColor: '#fafafaff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  errorText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 12
  },
  btnBackFallback: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#107c41'
  },
  btnBackFallbackText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#ffffff'
  }
});
