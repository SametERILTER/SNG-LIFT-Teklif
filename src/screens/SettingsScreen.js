import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Image,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS, STORAGE_KEY, SETTINGS_KEY } from '../constants/theme';
import { useScreenTransition } from '../utils/useScreenTransition';
import { APP_COMPANY_CONFIG } from '../config';

const STATUSBAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 44;
const COLLAPSE_AMOUNT = 46;
const HEADER_HEIGHT = STATUSBAR_H + 98;
const SCROLL_DISTANCE = 110;

const DEFAULT_SETTINGS = {
  companyName: APP_COMPANY_CONFIG.companyName,
  phone: APP_COMPANY_CONFIG.phone,
  email: APP_COMPANY_CONFIG.email,
  bankAccountTitle: APP_COMPANY_CONFIG.bankAccountTitle,
  garantiIban: APP_COMPANY_CONFIG.garantiIban,
  vakifIban: APP_COMPANY_CONFIG.vakifIban,
  ziraatIban: APP_COMPANY_CONFIG.ziraatIban,
  garantiUsdIban: APP_COMPANY_CONFIG.garantiUsdIban,
  vakifUsdIban: APP_COMPANY_CONFIG.vakifUsdIban,
  ziraatUsdIban: APP_COMPANY_CONFIG.ziraatUsdIban,
  defaultKdv: APP_COMPANY_CONFIG.defaultKdv || '20'
};

export default function SettingsScreen({ navigation }) {
  const { animatedStyle, handleGoBack } = useScreenTransition(navigation);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [proposalCount, setProposalCount] = useState(0);
  const [focusedInput, setFocusedInput] = useState(null);

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

  // 3. Büyük "Uygulama Ayarları" başlığının süzülerek kaybolması
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

  // 5. Küçük "Uygulama Ayarları" başlığının yumuşakça belirmesi (GPU Opacity & Transform)
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

  useEffect(() => {
    loadSettings();
    loadProposalCount();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({
          companyName: parsed.companyName || DEFAULT_SETTINGS.companyName,
          phone: parsed.phone || DEFAULT_SETTINGS.phone,
          email: parsed.email || DEFAULT_SETTINGS.email,
          bankAccountTitle: parsed.bankAccountTitle || DEFAULT_SETTINGS.bankAccountTitle,
          garantiIban: parsed.garantiIban || DEFAULT_SETTINGS.garantiIban,
          vakifIban: parsed.vakifIban || DEFAULT_SETTINGS.vakifIban,
          ziraatIban: parsed.ziraatIban || DEFAULT_SETTINGS.ziraatIban,
          garantiUsdIban: parsed.garantiUsdIban || DEFAULT_SETTINGS.garantiUsdIban,
          vakifUsdIban: parsed.vakifUsdIban || DEFAULT_SETTINGS.vakifUsdIban,
          ziraatUsdIban: parsed.ziraatUsdIban || DEFAULT_SETTINGS.ziraatUsdIban,
          defaultKdv: parsed.defaultKdv || DEFAULT_SETTINGS.defaultKdv
        });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (e) {
      console.log('Ayarlar yüklenemedi:', e);
    }
  };

  const loadProposalCount = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        setProposalCount(Array.isArray(list) ? list.length : 0);
      }
    } catch (e) {
      console.log('Teklif sayısı alınamadı:', e);
    }
  };

  const updateField = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      Alert.alert('Başarılı', 'Ayarlar başarıyla kaydedildi.', [{ text: 'Tamam' }]);
    } catch (e) {
      Alert.alert('Hata', 'Ayarlar kaydedilirken bir hata oluştu.');
    }
  };

  const handleResetDefaults = () => {
    Alert.alert(
      'Varsayılana Sıfırla',
      'Tüm ayarlar varsayılan değerlerine (%20 KDV dahil) döndürülecektir. Onaylıyor musunuz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            setSettings(DEFAULT_SETTINGS);
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
            Alert.alert('Tamamlandı', 'Ayarlar varsayılana sıfırlandı.');
          }
        }
      ]
    );
  };

  const handleClearAllProposals = () => {
    Alert.alert(
      'Teklif Geçmişini Temizle',
      'Kayıtlı tüm teklifler kalıcı olarak silinecektir. Bu işlem geri alınamaz!',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Tümünü Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
              setProposalCount(0);
              Alert.alert('Bilgi', 'Tüm teklif geçmişi başarıyla silindi.');
            } catch (e) {
              Alert.alert('Hata', 'Teklifler silinirken hata oluştu.');
            }
          }
        }
      ]
    );
  };

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* 1. ÜST YEŞİL KURUMSAL BAŞLIK BARI (GPU HIZLANDIRMALI 0-LAG DİNAMİK HEADER) */}
      <Animated.View style={[styles.topGreenHeader, headerAnimatedStyle]}>
        <SafeAreaView>
          {/* Üst Satır: (Geri Butonu + Yanındaki Dinamik Başlık) + (Kaydet Butonu) */}
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

              {/* Dinamik Başlık Alanı (Ana Sayfa -> Uygulama Ayarları Crossfade) */}
              <View style={styles.headerTitleSwapContainer}>
                {/* 1. Scroll Edilmemişken: "Ana Sayfa" */}
                <Animated.View style={[styles.titleSwapItem, backTextAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.btnBackText} numberOfLines={1}>Ana Sayfa</Text>
                </Animated.View>

                {/* 2. Scroll Edilince: "Uygulama Ayarları" */}
                <Animated.View style={[styles.titleSwapItem, smallTitleAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.smallHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">
                    Uygulama Ayarları
                  </Text>
                </Animated.View>
              </View>
            </View>

            {/* Sağ Üst: Kaydet Butonu */}
            <TouchableOpacity
              style={styles.btnSaveHeader}
              onPress={handleSaveSettings}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-sharp" size={16} color="#107c41" style={{ marginRight: 4 }} />
              <Text style={styles.btnSaveHeaderText}>Kaydet</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Alt Satır: "Uygulama Ayarları" (Scroll ile yukarı doğru süzülerek kaybolur) */}
          <Animated.View style={[styles.titleRowContainer, titleRowAnimatedStyle]}>
            <Text style={styles.pageHeaderTitle} numberOfLines={1}>Uygulama Ayarları</Text>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>

      {/* 2. AYARLAR İÇERİK FORMU (KUTUSUZ, DÜZ AKAN TASARIM) */}
      <View style={styles.bodyContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 14 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* BÖLÜM 1: FİRMA VE İLETİŞİM BİLGİLERİ */}
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>FİRMA VE İLETİŞİM BİLGİLERİ</Text>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Firma Adı</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'companyName' && styles.inputFocused]}
                placeholder="Örn: ABC Asansör San. Ltd."
                placeholderTextColor={MS.textMuted}
                value={settings.companyName}
                onChangeText={(val) => updateField('companyName', val)}
                onFocus={() => setFocusedInput('companyName')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.rowTwoCols}>
              <View style={[styles.inputField, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.fieldLabel}>Telefon</Text>
                <TextInput
                  style={[styles.textInput, focusedInput === 'phone' && styles.inputFocused]}
                  placeholder="0500 000 00 00"
                  placeholderTextColor={MS.textMuted}
                  value={settings.phone}
                  onChangeText={(val) => updateField('phone', val)}
                  keyboardType="phone-pad"
                  onFocus={() => setFocusedInput('phone')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[styles.inputField, { flex: 1, marginLeft: 8 }]}>
                <Text style={styles.fieldLabel}>E-Posta</Text>
                <TextInput
                  style={[styles.textInput, focusedInput === 'email' && styles.inputFocused]}
                  placeholder="info@sirketiniz.com"
                  placeholderTextColor={MS.textMuted}
                  value={settings.email}
                  onChangeText={(val) => updateField('email', val)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('email')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>
            </View>

            {/* BÖLÜM 2: BANKA & HESAP BİLGİLERİ */}
            <Text style={styles.sectionTitle}>BANKA & HESAP BİLGİLERİ</Text>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Banka Hesap Bilgisi (Hesap Sahibi)</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { height: 60, textAlignVertical: 'top', paddingTop: 9 },
                  focusedInput === 'bankAccountTitle' && styles.inputFocused
                ]}
                placeholder="Örn: ABC ASANSÖR MÜHENDİSLİK SAN. VE TİC. LTD. ŞTİ."
                placeholderTextColor={MS.textMuted}
                value={settings.bankAccountTitle}
                onChangeText={(val) => updateField('bankAccountTitle', val)}
                multiline
                onFocus={() => setFocusedInput('bankAccountTitle')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Garanti Bankası (TL) IBAN</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'garantiIban' && styles.inputFocused]}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={MS.textMuted}
                value={settings.garantiIban}
                onChangeText={(val) => updateField('garantiIban', val)}
                autoCapitalize="characters"
                onFocus={() => setFocusedInput('garantiIban')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Vakıfbank (TL) IBAN</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'vakifIban' && styles.inputFocused]}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={MS.textMuted}
                value={settings.vakifIban}
                onChangeText={(val) => updateField('vakifIban', val)}
                autoCapitalize="characters"
                onFocus={() => setFocusedInput('vakifIban')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Ziraat Bankası (TL) IBAN</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'ziraatIban' && styles.inputFocused]}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={MS.textMuted}
                value={settings.ziraatIban}
                onChangeText={(val) => updateField('ziraatIban', val)}
                autoCapitalize="characters"
                onFocus={() => setFocusedInput('ziraatIban')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Garanti Bankası (USD) IBAN</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'garantiUsdIban' && styles.inputFocused]}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={MS.textMuted}
                value={settings.garantiUsdIban}
                onChangeText={(val) => updateField('garantiUsdIban', val)}
                autoCapitalize="characters"
                onFocus={() => setFocusedInput('garantiUsdIban')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Vakıfbank (USD) IBAN</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'vakifUsdIban' && styles.inputFocused]}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={MS.textMuted}
                value={settings.vakifUsdIban}
                onChangeText={(val) => updateField('vakifUsdIban', val)}
                autoCapitalize="characters"
                onFocus={() => setFocusedInput('vakifUsdIban')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Ziraat Bankası (USD) IBAN</Text>
              <TextInput
                style={[styles.textInput, focusedInput === 'ziraatUsdIban' && styles.inputFocused]}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                placeholderTextColor={MS.textMuted}
                value={settings.ziraatUsdIban}
                onChangeText={(val) => updateField('ziraatUsdIban', val)}
                autoCapitalize="characters"
                onFocus={() => setFocusedInput('ziraatUsdIban')}
                onBlur={() => setFocusedInput(null)}
              />
            </View>

            {/* BÖLÜM 3: KDV ORANI (%20) */}
            <Text style={styles.sectionTitle}>KDV ORANI AYARI</Text>

            <View style={styles.inputField}>
              <Text style={styles.fieldLabel}>Varsayılan KDV Oranı (%)</Text>
              <View style={styles.kdvInputContainer}>
                <TextInput
                  style={[
                    styles.textInput,
                    { flex: 1, borderRightWidth: 0 },
                    focusedInput === 'defaultKdv' && styles.inputFocused
                  ]}
                  placeholder="20"
                  placeholderTextColor={MS.textMuted}
                  value={settings.defaultKdv}
                  onChangeText={(val) => updateField('defaultKdv', val)}
                  keyboardType="numeric"
                  onFocus={() => setFocusedInput('defaultKdv')}
                  onBlur={() => setFocusedInput(null)}
                />
                <View style={styles.kdvBadge}>
                  <Text style={styles.kdvBadgeText}>%</Text>
                </View>
              </View>
              <Text style={styles.kdvInfoText}>
                Oluşturulan yeni tekliflerde standart KDV oranı %{settings.defaultKdv || '20'} olarak hesaplanacaktır.
              </Text>
            </View>

            {/* BÖLÜM 4: VERİ & HAFIZA YÖNETİMİ */}
            <Text style={styles.sectionTitle}>VERİ VE HAFIZA YÖNETİMİ</Text>

            <View style={styles.dataInfoRow}>
              <Text style={styles.dataInfoLabel}>Kayıtlı Toplam Teklif:</Text>
              <Text style={styles.dataInfoValue}>{proposalCount} Adet</Text>
            </View>

            <TouchableOpacity
              style={styles.btnSquareDanger}
              onPress={handleClearAllProposals}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={MS.danger} style={{ marginRight: 6 }} />
              <Text style={styles.btnSquareDangerText}>Tüm Teklif Geçmişini Sil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSquareReset}
              onPress={handleResetDefaults}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={MS.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.btnSquareResetText}>Ayarları Varsayılana Sıfırla (%20 KDV)</Text>
            </TouchableOpacity>

            {/* BÖLÜM 5: UYGULAMA HAKKINDA & LOGO */}
            <View style={styles.aboutContainer}>
              <Image
                source={require('../../assets/sng_logo.png')}
                style={styles.aboutLogo}
                resizeMode="contain"
              />
              <Text style={styles.aboutTitle}>SNG LIFT ASANSÖR TEKLİF YÖNETİMİ</Text>
              <Text style={styles.aboutCopyright}>© 2026 SNG LIFT Tüm Hakları Saklıdır.</Text>
            </View>

            <View style={{ height: 40 }} />
          </Animated.ScrollView>
        </KeyboardAvoidingView>
      </View>
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
  btnSaveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 0
  },
  btnSaveHeaderText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41'
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
  bodyContainer: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#fafafaff'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fafafaff'
  },
  sectionTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: MS.textPrimary,
    letterSpacing: 0.5,
    marginTop: 22,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: MS.borderSubtle
  },
  inputField: {
    marginBottom: 12
  },
  fieldLabel: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    fontWeight: '500',
    color: MS.textSecondary,
    marginBottom: 4
  },
  textInput: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '400',
    color: MS.textPrimary,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 0,
    height: 42
  },
  inputFocused: {
    borderColor: '#107c41',
    borderWidth: 1.5
  },
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  kdvInputContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  kdvBadge: {
    width: 42,
    height: 42,
    backgroundColor: '#f3f2f1',
    borderWidth: 1,
    borderColor: MS.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 0
  },
  kdvBadgeText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: MS.textPrimary
  },
  kdvInfoText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: MS.textMuted,
    marginTop: 5
  },
  dataInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: MS.borderSubtle,
    marginBottom: 12
  },
  dataInfoLabel: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    color: MS.textPrimary
  },
  dataInfoValue: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 13,
    color: MS.accent
  },
  btnSquareDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.danger,
    borderRadius: 0,
    marginBottom: 10
  },
  btnSquareDangerText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.danger
  },
  btnSquareReset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderRadius: 0
  },
  btnSquareResetText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: MS.textSecondary
  },
  aboutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 28,
    paddingBottom: 20
  },
  aboutLogo: {
    width: 96,
    height: 56,
    marginBottom: 10
  },
  aboutTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: MS.textSecondary,
    letterSpacing: 0.5
  },
  aboutCopyright: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: MS.textMuted,
    marginTop: 4
  }
});
