import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS, STORAGE_KEY } from '../constants/theme';
import { generateProposalHTML, exportAndSharePDF } from '../utils/pdfGenerator';
import { useScreenTransition } from '../utils/useScreenTransition';
import ProposalPreviewModal from '../components/ProposalPreviewModal';

const SUCCESS_TITLE_CHARS = 'Teklif Oluşturuldu'.split('');

export default function ProposalSuccessScreen({ route, navigation }) {
  const { animatedStyle } = useScreenTransition(navigation);
  const { proposalRecord: initialRecord } = route.params || {};
  const [currentRecord, setCurrentRecord] = useState(initialRecord || {});
  const [isSharing, setIsSharing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [isIntroAnimating, setIsIntroAnimating] = useState(true);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Rozet ve yumuşak hale animasyonu (Bordersız, pürüzsüz)
  const badgeScale = useSharedValue(0.7);
  const haloScale = useSharedValue(0.8);
  const haloOpacity = useSharedValue(0.8);

  const payload = currentRecord?.payload || currentRecord || {};

  // PDF HTML İçeriğini Hazırla
  const htmlContent = currentRecord?.savedHTML || generateProposalHTML(payload, { isEditable: false });

  // Teklif A4 şablonunun tam oranına göre kutu yüksekliği hesapla
  const cardWidth = Math.min(windowWidth - 32, 500);
  const previewHeight = Math.min(windowHeight * 0.62, cardWidth * 1.42);

  const clientFirmaName = payload.clientFirma || payload.firma || '';
  const firmaChars = clientFirmaName.split('');

  useEffect(() => {
    badgeScale.value = withTiming(1, { duration: 320, easing: Easing.inOut(Easing.ease) });
    haloScale.value = withTiming(1.18, { duration: 480, easing: Easing.inOut(Easing.ease) });
    haloOpacity.value = withTiming(0.4, { duration: 480, easing: Easing.inOut(Easing.ease) });

    const totalAnimTime = Math.max(1400, 100 + SUCCESS_TITLE_CHARS.length * 28 + 60 + firmaChars.length * 24 + 450);
    const timer = setTimeout(() => {
      setIsIntroAnimating(false);
    }, totalAnimTime);
    return () => clearTimeout(timer);
  }, [firmaChars.length]);

  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }]
  }));

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value
  }));

  const handleShare = async () => {
    try {
      setIsSharing(true);
      await exportAndSharePDF(currentRecord?.payload || currentRecord);
      return true;
    } catch (err) {
      console.log('PDF paylaşım hatası:', err);
      return false;
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveUpdatedRecord = async (updatedRecord) => {
    try {
      setCurrentRecord(updatedRecord);
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        const nextList = list.map(item => String(item.id) === String(updatedRecord.id) ? updatedRecord : item);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
      }
    } catch (e) {
      console.log('Teklif kaydı güncellenemedi:', e);
    }
  };

  const handleGoHome = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Home' }]
    });
  };

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* --- A) TİK İKONU + YAZILMA ANİMASYONLU BAŞLIK VE FİRMA ADI --- */}
      {isIntroAnimating ? (
        <Animated.View
          key="intro-screen"
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(240).easing(Easing.inOut(Easing.ease))}
          style={styles.introContainer}
        >
          {/* 1. Üst Tik İkonu & Yumuşak Hale */}
          <View style={styles.introIconWrapper}>
            <Animated.View style={[styles.introOuterHalo, haloAnimatedStyle]} />
            <Animated.View style={[styles.introCheckBadge, badgeAnimatedStyle]}>
              <Ionicons name="checkmark-sharp" size={30} color="#ffffff" />
            </Animated.View>
          </View>

          {/* 2. 'Teklif Oluşturuldu' Ease Yazma Animasyonu */}
          <Animated.View
            entering={FadeIn.duration(180).easing(Easing.inOut(Easing.ease))}
            style={styles.titleRow}
          >
            {SUCCESS_TITLE_CHARS.map((char, index) => (
              <Animated.Text
                key={`succ-char-${index}`}
                entering={FadeIn.duration(110)
                  .delay(100 + index * 28)
                  .easing(Easing.inOut(Easing.ease))}
                style={styles.introTitleChar}
              >
                {char === ' ' ? '\u00A0' : char}
              </Animated.Text>
            ))}
          </Animated.View>

          {/* 3. Altında Harf Harf Yazılan Firma Adı */}
          {firmaChars.length > 0 && (
            <View style={styles.introFirmaRow}>
              {firmaChars.map((char, index) => (
                <Animated.Text
                  key={`firma-char-${index}`}
                  entering={FadeIn.duration(100)
                    .delay(100 + SUCCESS_TITLE_CHARS.length * 28 + 60 + index * 24)
                    .easing(Easing.inOut(Easing.ease))}
                  style={styles.introFirmaChar}
                >
                  {char === ' ' ? '\u00A0' : char}
                </Animated.Text>
              ))}
            </View>
          )}
        </Animated.View>
      ) : (
        /* --- B) ASIL TEKLİF ÖNİZLEME & AKSİYON SAYFASI --- */
        <Animated.View
          key="main-screen"
          entering={FadeIn.duration(300).easing(Easing.out(Easing.cubic))}
          style={{ flex: 1 }}
        >
          {/* 1. ÜST YEŞİL KURUMSAL HEADER */}
          <View style={styles.topGreenHeader}>
            <SafeAreaView>
              <View style={styles.topNavHeaderRow}>
                {/* Sol: Ana Sayfa Butonu */}
                <TouchableOpacity
                  style={styles.btnNavHome}
                  onPress={handleGoHome}
                  activeOpacity={0.7}
                >
                  <Ionicons name="home-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.btnNavHomeText}>Ana Sayfa</Text>
                </TouchableOpacity>

                {/* Ana Sayfa Butonunun Hemen Sağında: Teklif Oluşturuldu ve Sağında Beyaz Tik İkonu */}
                <View style={styles.headerStatusTextRow}>
                  <Text style={styles.headerStatusTitleText}>Teklif Oluşturuldu</Text>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                </View>
              </View>
            </SafeAreaView>
          </View>

          {/* 2. ORTA CANLI PDF ÖNİZLEME VE HEMEN ALTINDAKİ BUTONLAR */}
          <ScrollView
            style={styles.bodyContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* PDF Önizleme Kutusu */}
            <Animated.View
              entering={FadeInDown.duration(280).easing(Easing.out(Easing.cubic))}
              style={[styles.webviewWrapper, { width: cardWidth, height: previewHeight }]}
            >
              <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={styles.webview}
                scalesPageToFit={Platform.OS === 'android'}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
              />
            </Animated.View>

            {/* PDF Önizlemesinin Hemen Altında Başlayan Aksiyon Butonları */}
            <Animated.View
              entering={FadeInUp.delay(60).duration(280).easing(Easing.out(Easing.cubic))}
              style={[styles.actionsContainer, { width: cardWidth }]}
            >
              {/* 1. Mavi PDF Olarak Paylaş Butonu */}
              <TouchableOpacity
                style={styles.btnSharePrimary}
                onPress={handleShare}
                activeOpacity={0.8}
                disabled={isSharing}
              >
                {isSharing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="share-social-outline" size={16} color="#ffffff" style={{ marginRight: 7 }} />
                    <Text style={styles.btnSharePrimaryText}>PDF OLARAK PAYLAŞ</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* 2. PDF'i Düzenle Butonu */}
              <TouchableOpacity
                style={styles.btnEditProposal}
                onPress={() => setEditModalVisible(true)}
                activeOpacity={0.75}
              >
                <Ionicons name="create-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.btnEditProposalText}>PDF'İ DÜZENLE</Text>
              </TouchableOpacity>

              {/* 3. Ana Sayfaya Dön Butonu */}
              <TouchableOpacity
                style={styles.btnSecondaryHome}
                onPress={handleGoHome}
                activeOpacity={0.7}
              >
                <Ionicons name="arrow-back-outline" size={16} color="#374151" style={{ marginRight: 6 }} />
                <Text style={styles.btnSecondaryHomeText}>ANA SAYFAYA DÖN</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      )}

      {/* --- UYGULAMA İÇİ CANLI DÜZENLENEBİLİR PDF ÖNİZLEME MODALI --- */}
      <ProposalPreviewModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        proposalRecord={currentRecord}
        onSaveUpdatedRecord={handleSaveUpdatedRecord}
        initialEditMode={true}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#fafafaff',
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

  // --- BORDERSIZ, ZARİF BAŞARI GEÇİŞİ STİLLERİ ---
  introContainer: {
    flex: 1,
    backgroundColor: '#fafafaff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 48
  },
  introIconWrapper: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  introOuterHalo: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#e8f5e9'
  },
  introCheckBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#107c41',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#107c41',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 6,
    paddingHorizontal: 12
  },
  introTitleChar: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 22,
    color: '#0f172a',
    letterSpacing: 0.3
  },
  introFirmaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 4,
    paddingHorizontal: 16
  },
  introFirmaChar: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#1e293b',
    letterSpacing: 0.2
  },

  // --- ANA EKRAN STİLLERİ ---
  topGreenHeader: {
    backgroundColor: '#107c41',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 22,
    paddingBottom: 14,
    paddingHorizontal: 16
  },
  topNavHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  btnNavHome: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 0,
    backgroundColor: 'transparent'
  },
  btnNavHomeText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#ffffff'
  },
  headerStatusTextRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerStatusTitleText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#ffffff',
    letterSpacing: 0.2
  },

  // İçerik Alanı
  bodyContainer: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 14
  },

  // PDF Önizleme Kutusu (Tam Teklif Boyutuna Uyarlanmış)
  webviewWrapper: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 0,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  webview: {
    flex: 1,
    backgroundColor: '#ffffff'
  },

  // Hemen Önizleme Altındaki Aksiyon Butonları
  actionsContainer: {
    marginTop: 10,
    gap: 7
  },
  btnSharePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4', // Mavi buton
    paddingVertical: 10,
    borderRadius: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  btnSharePrimaryText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#ffffff',
    letterSpacing: 0.3
  },
  btnEditProposal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#107c41', // Kurumsal canlı yeşil
    paddingVertical: 10,
    borderRadius: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2
  },
  btnEditProposalText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#ffffff',
    letterSpacing: 0.3
  },
  btnSecondaryHome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#9ca3af',
    paddingVertical: 9.5,
    borderRadius: 0
  },
  btnSecondaryHomeText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: '#374151',
    letterSpacing: 0.2
  }
});
