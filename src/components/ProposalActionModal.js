import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
  Alert,
  StatusBar,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { MS } from '../constants/theme';
import Constants from 'expo-constants';
import ProposalMotorTable from './ProposalMotorTable';

export default function ProposalActionModal({
  visible,
  onClose,
  proposal,
  originLayout,
  onPreview,
  onShare,
  onDelete,
  formatUSD
}) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Hedef Modal Boyutları (Kusursuz dikey ve yatay ortalanmış)
  const TARGET_WIDTH = Math.min(windowWidth * 0.94, 480);
  const TARGET_HEIGHT = Math.min(windowHeight * 0.83, 700);
  const TARGET_LEFT = (windowWidth - TARGET_WIDTH) / 2;
  const TARGET_TOP = (windowHeight - TARGET_HEIGHT) / 2;

  const [activeProposal, setActiveProposal] = useState(proposal);
  const [isRendered, setIsRendered] = useState(visible);

  // Animasyon Değerleri (GPU UI Thread)
  const progress = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const startX = useSharedValue(TARGET_LEFT);
  const startY = useSharedValue(windowHeight * 0.35);
  const startWidth = useSharedValue(TARGET_WIDTH);
  const startHeight = useSharedValue(100);

  // Teklif verisini senkronize tut
  useEffect(() => {
    if (proposal) {
      setActiveProposal(proposal);
    }
  }, [proposal]);

  const finishClose = useCallback(() => {
    setIsRendered(false);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const handleDismiss = useCallback(() => {
    // Kapanırken: Sıkıştırma olmadan içindekiler sadece opacity ile yavaşça yok olur,
    // aynı anda dış kart yumuşakça küçülerek tam eski kartın konumuna oturur.
    progress.value = withTiming(0, {
      duration: 360,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    }, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });

    backdropOpacity.value = withTiming(0, {
      duration: 320,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1)
    });
  }, [finishClose]);

  useEffect(() => {
    if (visible) {
      setIsRendered(true);

      // Android'de statusBarTranslucent={true} modalı için:
      // Expo Go'da measureInWindow status bar altını baz alırken, Standalone APK'da tüm ekranı (y=0'dan) doğrudan ve tam olarak ölçer.
      const isExpoGo = Constants?.appOwnership === 'expo' || Constants?.executionEnvironment === 'storeClient';
      const STATUSBAR_OFFSET = Platform.OS === 'android' && isExpoGo ? (StatusBar.currentHeight || 0) : 0;

      // Basılan kartın koordinat ve boyutlarını al (piksel piksel tam hizalı)
      const sX = (originLayout?.x !== undefined && originLayout.x >= 0) ? originLayout.x : TARGET_LEFT;
      const sY = (originLayout?.y !== undefined && originLayout.y >= 0) ? (originLayout.y + STATUSBAR_OFFSET) : (windowHeight * 0.35);
      const sW = (originLayout?.width !== undefined && originLayout.width > 0) ? originLayout.width : TARGET_WIDTH;
      const sH = (originLayout?.height !== undefined && originLayout.height > 0) ? originLayout.height : 100;

      startX.value = sX;
      startY.value = sY;
      startWidth.value = sW;
      startHeight.value = sH;

      progress.value = 0;
      backdropOpacity.value = 0;

      // Açılış Animasyonu: Kadifemsi yumuşak başlangıç ve zarif iniş (Hiçbir sert fırlama / sıçrama yok)
      progress.value = withTiming(1, {
        duration: 440,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      });

      backdropOpacity.value = withTiming(1, {
        duration: 400,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1)
      });
    } else if (isRendered) {
      handleDismiss();
    }
  }, [visible, originLayout]);

  // Arka Plan Overlay (Doğrudan progress ile %100 senkronize ve tam ekran)
  const backdropAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    return {
      opacity
    };
  });

  // Dış Kart Kutusu: Basılan kart konumu ile modal konumu arasında pürüzsüz boyut ve pozisyon morph'u
  const expandingCardAnimatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    const left = interpolate(p, [0, 1], [startX.value, TARGET_LEFT], Extrapolation.CLAMP);
    const top = interpolate(p, [0, 1], [startY.value, TARGET_TOP], Extrapolation.CLAMP);
    const width = interpolate(p, [0, 1], [startWidth.value, TARGET_WIDTH], Extrapolation.CLAMP);
    const height = interpolate(p, [0, 1], [startHeight.value, TARGET_HEIGHT], Extrapolation.CLAMP);
    const borderRadius = interpolate(p, [0, 1], [0, 16], Extrapolation.CLAMP);
    const borderWidth = interpolate(p, [0, 1], [0, 1], Extrapolation.CLAMP);
    const shadowOpacity = interpolate(p, [0, 1], [0, 0.18], Extrapolation.CLAMP);
    const elevation = interpolate(p, [0, 1], [0, 20], Extrapolation.CLAMP);
    const backgroundColor = interpolateColor(p, [0, 1], ['#f3f3f3', '#ffffff']);
    const borderColor = interpolateColor(p, [0, 1], ['transparent', '#e2e8f0']);

    return {
      position: 'absolute',
      left,
      top,
      width,
      height,
      borderRadius,
      backgroundColor,
      borderWidth,
      borderColor,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity,
      shadowRadius: 20,
      elevation,
      overflow: 'hidden',
      zIndex: 10
    };
  });

  // 1. Kapalı Kart Katmanı (İlk açılışta ve kapanırken orijinal kartla %100 birebir tam oturur)
  const closedCardAnimatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [0, 0.35], [1, 0], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      opacity,
      pointerEvents: p < 0.15 ? 'auto' : 'none'
    };
  });

  // 2. Açık Detay Katmanı (Sıkıştırma YOK! Sabit boyutta durur, sadece OPACITY ve hafif süzülmeyle yumuşakça gelir)
  const fullDetailAnimatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const opacity = interpolate(p, [0.22, 0.90], [0, 1], Extrapolation.CLAMP);
    const translateY = interpolate(p, [0.22, 1], [8, 0], Extrapolation.CLAMP);
    return {
      position: 'absolute',
      top: 0,
      left: 0,
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      opacity,
      transform: [{ translateY }],
      pointerEvents: p > 0.4 ? 'auto' : 'none'
    };
  });

  if (!isRendered && !visible) return null;
  const currentProposal = activeProposal || proposal;
  if (!currentProposal) return null;

  const currency = currentProposal.currency || currentProposal.payload?.currency || 'USD';

  const handleDeletePress = () => {
    Alert.alert(
      'Teklifi Sil',
      `"${currentProposal.firma || ('NO: ' + currentProposal.teklifNo)}" teklifini silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            handleDismiss();
            if (onDelete) onDelete(currentProposal);
          }
        }
      ]
    );
  };

  const formattedTotal = formatUSD
    ? formatUSD(currentProposal.grandTotal, currency)
    : `$ ${parseFloat(currentProposal.grandTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`;

  return (
    <Modal
      visible={isRendered}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleDismiss}
    >
      <View style={styles.modalRoot}>
        {/* Koyu Overlay Arka Plan */}
        <Animated.View style={[styles.backdrop, backdropAnimatedStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={handleDismiss}
          />
        </Animated.View>

        {/* Büyüyen / Küçülen Köşeli Dış Kart Kutusu */}
        <Animated.View style={expandingCardAnimatedStyle}>
          {/* KATMAN 1: KAPALI TEKLİF KARTI GÖRÜNÜMÜ (Kapanırken yerine pürüzsüzce bu gelir) */}
          <Animated.View style={closedCardAnimatedStyle}>
            <View style={styles.closedCardInner}>
              <Text style={styles.closedCardTitle} numberOfLines={1}>
                {currentProposal.firma || 'Müşteri Belirtilmedi'}
              </Text>
              {currentProposal.yetkili ? (
                <Text style={styles.closedCardSub}>Yetkili: {currentProposal.yetkili}</Text>
              ) : null}
              <View style={styles.closedCardBottomRow}>
                <Text style={styles.closedCardBottomLabel}>Toplam Tutar</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.closedCardAmount}>{formattedTotal}</Text>
                  <Ionicons
                    name="ellipsis-horizontal-circle-outline"
                    size={20}
                    color={MS.accent}
                    style={{ marginLeft: 8 }}
                  />
                </View>
              </View>
            </View>
          </Animated.View>

          {/* KATMAN 2: AÇIK DETAY GÖRÜNÜMÜ (Profesyonel Kurumsal Tasarım) */}
          <Animated.View style={[styles.fullDetailLayer, fullDetailAnimatedStyle]}>
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
            >
              {/* 1. ÜST NAVİGASYON VE DURUM BARI */}
              <View style={styles.topNavBar}>
                <View style={styles.teklifBadge}>
                  <Text style={styles.teklifBadgeText}>TEKLİF NO: {currentProposal.teklifNo || '-'}</Text>
                </View>
                <View style={styles.headerRightBox}>
                  {currentProposal.tarih ? (
                    <View style={styles.dateChip}>
                      <Ionicons name="calendar-outline" size={13} color="#64748b" style={{ marginRight: 4 }} />
                      <Text style={styles.dateText}>{currentProposal.tarih}</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    onPress={handleDismiss}
                    style={styles.btnCloseIconCircle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={17} color="#475569" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 2. MÜŞTERİ / FİRMA BİLGİSİ (Kutusuz, Sade ve Doğrudan Başlık) */}
              <View style={styles.clientInfoCard}>
                <Text style={styles.clientTitle} numberOfLines={2}>
                  {currentProposal.firma || 'Müşteri Belirtilmedi'}
                </Text>
                {currentProposal.yetkili ? (
                  <View style={styles.clientYetkiliRow}>
                    <Ionicons name="person-outline" size={13} color="#64748b" style={{ marginRight: 5 }} />
                    <Text style={styles.clientSub}>{currentProposal.yetkili}</Text>
                  </View>
                ) : null}
              </View>

              {/* 3. FİNANSAL KPI / TOPLAM TUTAR KARTI */}
              <View style={styles.financialSummaryCard}>
                <View style={styles.financialLeftCol}>
                  <Text style={styles.financialLabel}>TOPLAM TEKLİF TUTARI</Text>
                  <Text style={styles.financialSubLabel}>KDV dahil</Text>
                </View>
                <Text style={styles.financialAmountValue}>{formattedTotal}</Text>
              </View>

              {/* 4. MOTOR TABLOSU BÖLÜMÜ */}
              <View style={styles.tableSection}>
                <ProposalMotorTable
                  proposal={currentProposal}
                  currency={currency}
                  formatUSD={formatUSD}
                />
              </View>

              {/* 5. HIZLI İŞLEMLER VE AKSİYONLAR */}
              <View style={styles.actionsSection}>
                <View style={styles.actionsList}>
                  {/* 1. PDF Önizle ve Düzenle */}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      handleDismiss();
                      if (onPreview) onPreview(currentProposal);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="eye-outline" size={20} color="#1e293b" style={styles.actionIcon} />
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>PDF Önizle ve Düzenle</Text>
                      <Text style={styles.actionSub}>Uygulama içinde teklif şablonunu açın ve düzenleyin</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                  </TouchableOpacity>

                  {/* 2. PDF Paylaş */}
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      if (onShare) onShare(currentProposal);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-social-outline" size={20} color="#1e293b" style={styles.actionIcon} />
                    <View style={styles.actionTextCol}>
                      <Text style={styles.actionTitle}>PDF Olarak Paylaş</Text>
                      <Text style={styles.actionSub}>WhatsApp, E-posta veya diğer uygulamalarla iletin</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                  </TouchableOpacity>

                  {/* 3. Teklifi Sil */}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonDelete]}
                    onPress={handleDeletePress}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color="#1e293b" style={styles.actionIcon} />
                    <View style={styles.actionTextCol}>
                      <Text style={[styles.actionTitle, { color: '#e11d48' }]}>Teklifi Sil</Text>
                      <Text style={styles.actionSub}>Bu teklif kaydını cihazınızdan kalıcı olarak kaldırın</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            {/* 6. SABİT EN ALT KAPATMA BUTONU (Pinned Footer) */}
            <View style={styles.bottomFooter}>
              <TouchableOpacity
                style={styles.btnClose}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.btnCloseText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 1
  },

  // Kapalı Kart Katmanı (Normal kart görünümü)
  closedCardInner: {
    width: '100%',
    backgroundColor: 'transparent',
    padding: 14,
    borderRadius: 0
  },
  closedCardTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#111827',
    marginBottom: 2
  },
  closedCardSub: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2
  },
  closedCardDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10
  },
  closedCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10
  },
  closedCardBottomLabel: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#6b7280'
  },
  closedCardAmount: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#111827'
  },

  // Açık Detay ScrollView
  scrollArea: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24
  },

  // 1. Üst Nav Bar
  topNavBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  teklifBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 0
  },
  teklifBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#334155',
    letterSpacing: 0.3
  },
  headerRightBox: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8
  },
  dateText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#64748b'
  },
  btnCloseIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center'
  },

  // 2. Müşteri / Firma Bilgisi (Kutusuz, Sade Zemin)
  clientInfoCard: {
    paddingVertical: 2,
    paddingHorizontal: 0,
    marginBottom: 16
  },
  clientTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 18,
    color: '#0f172a',
    lineHeight: 23
  },
  clientYetkiliRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  clientSub: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12.5,
    color: '#64748b'
  },

  // 3. Finansal Özet Kartı
  financialSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16
  },
  financialLeftCol: {
    flex: 1
  },
  financialLabel: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 11,
    color: '#15803d',
    letterSpacing: 0.4
  },
  financialSubLabel: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#16a34a',
    marginTop: 1
  },
  financialAmountValue: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 19,
    color: '#15803d'
  },

  // 4. Tablo Bölümü
  tableSection: {
    marginTop: 16,
    marginBottom: 22
  },

  // 5. Aksiyonlar Bölümü
  actionsSection: {
    marginTop: 25
  },
  actionsList: {
    gap: 8
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f7f7ff',
    borderWidth: 0,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 13
  },
  actionButtonDelete: {
    backgroundColor: '#f7f7f7ff'
  },
  actionIcon: {
    marginRight: 12,
    marginLeft: 2
  },
  actionTextCol: {
    flex: 1
  },
  actionTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12.5,
    color: '#0f172a',
    marginBottom: 1
  },
  actionSub: {
    fontFamily: MS.fontFamily,
    fontSize: 10.5,
    color: '#64748b',
    lineHeight: 14
  },

  // 6. Sabit Alt Kapat Butonu
  bottomFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 14 : 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff'
  },
  btnClose: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnCloseText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13.5,
    color: '#475569'
  }
});
