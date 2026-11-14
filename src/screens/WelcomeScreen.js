import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS } from '../constants/theme';
import { APP_COMPANY_CONFIG } from '../config';

export const HAS_SEEN_WELCOME_KEY = 'SNG_HAS_SEEN_WELCOME_V1';

const TITLE_LETTERS = (APP_COMPANY_CONFIG.companyName || 'LIFT PRO').toUpperCase().split('');

const FEATURES = [
  {
    id: 'f1',
    icon: 'flash-outline',
    title: 'Hızlı Teklif Oluşturma',
    desc: 'Müşteri, bina ve motor seçimleriyle dakikalar içinde eksiksiz teklif hazırlayın.'
  },
  {
    id: 'f2',
    icon: 'trending-up-outline',
    title: 'Canlı Kurlar ve Maliyet Hesabı',
    desc: 'TCMB canlı döviz kurları, dinamik kâr ve iskonto oranlarıyla otomatik hesaplama.'
  },
  {
    id: 'f3',
    icon: 'document-text-outline',
    title: 'Kurumsal PDF ve Paylaşım',
    desc: 'Hazırlanan teklifleri resmi PDF formatına dönüştürüp tek tıkla müşterinize iletin.'
  }
];

export default function WelcomeScreen({ navigation }) {
  // Buton basma animasyonu (Yaylanmasız, pürüzsüz)
  const btnScale = useSharedValue(1);
  const btnOpacity = useSharedValue(1);

  const btnAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
    opacity: btnOpacity.value
  }));

  const handleFinishWelcome = async () => {
    try {
      await AsyncStorage.setItem(HAS_SEEN_WELCOME_KEY, 'true');
    } catch (e) {}
    navigation.replace('Home');
  };

  const handleBtnPressIn = () => {
    btnScale.value = withTiming(0.97, { duration: 90, easing: Easing.out(Easing.quad) });
    btnOpacity.value = withTiming(0.92, { duration: 90, easing: Easing.out(Easing.quad) });
  };

  const handleBtnPressOut = () => {
    btnScale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
    btnOpacity.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
  };

  return (
    <View style={styles.rootContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#fafafa" translucent={false} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* --- HERO / SOLA HİZALI LOGO VE BÜYÜK YAZILMA ANİMASYONLU BAŞLIK --- */}
          <View style={styles.heroSection}>
            <Animated.View
              entering={FadeInDown.duration(400).delay(80).easing(Easing.out(Easing.cubic))}
              style={styles.logoWrapper}
            >
              <Image
                source={require('../../assets/sng_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>

            {/* SNG LIFT Büyük & Yavaş Harf Harf Yazılma Animasyonu */}
            <View style={styles.titleRow}>
              {TITLE_LETTERS.map((char, index) => (
                <Animated.Text
                  key={`char-${index}`}
                  entering={FadeIn.duration(180)
                    .delay(200 + index * 120)
                    .easing(Easing.out(Easing.quad))}
                  style={styles.brandTitleChar}
                >
                  {char === ' ' ? '\u00A0' : char}
                </Animated.Text>
              ))}
            </View>

            {/* Sola Hizalı Alt Başlık */}
            <Animated.Text
              entering={FadeInDown.duration(400).delay(1250).easing(Easing.out(Easing.cubic))}
              style={styles.brandSubtitle}
            >
              Teklif Yönetim Sistemi
            </Animated.Text>
          </View>

          {/* --- ÖZELLİK LİSTESİ (ARKA PLANSIZ & GRİMSİ İKONLAR) --- */}
          <View style={styles.featuresSection}>
            {FEATURES.map((item) => (
              <View key={item.id} style={styles.featureRow}>
                <View style={styles.iconContainer}>
                  <Ionicons name={item.icon} size={23} color="#605e5c" />
                </View>

                <View style={styles.featureTextWrapper}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* --- ALT BUTON ALANI (KÖŞELİ & DAHA YUKARIDA) --- */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(1400).easing(Easing.out(Easing.cubic))}
          style={styles.bottomSection}
        >
          <Animated.View style={[styles.btnStartWrapper, btnAnimatedStyle]}>
            <TouchableOpacity
              style={styles.btnStart}
              onPress={handleFinishWelcome}
              onPressIn={handleBtnPressIn}
              onPressOut={handleBtnPressOut}
              activeOpacity={1}
            >
              <Text style={styles.btnStartText}>Başlayın</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#fafafa'
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#fafafa'
  },

  // Scroll İçeriği & Üst Boşluk
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'android' ? 36 : 24,
    paddingBottom: 16
  },

  // Hero / Logo Bölümü (Sola Hizalı)
  heroSection: {
    alignItems: 'flex-start',
    marginTop: 10,
    marginBottom: 34
  },
  logoWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22
  },
  logoImage: {
    width: 88,
    height: 88
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  brandTitleChar: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 34,
    color: '#201f1e',
    letterSpacing: 0.5
  },
  brandSubtitle: {
    fontFamily: MS.fontFamilyRegular,
    fontSize: 15.5,
    color: '#605e5c',
    textAlign: 'left',
    marginTop: 2
  },

  // Özellik Maddeleri (Arka plansız, grimsi ikonlar)
  featuresSection: {
    marginTop: 6
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
    paddingVertical: 10,
    marginBottom: 16
  },
  iconContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 1
  },
  featureTextWrapper: {
    flex: 1
  },
  featureTitle: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 15,
    color: '#201f1e',
    marginBottom: 3
  },
  featureDesc: {
    fontFamily: MS.fontFamilyRegular,
    fontSize: 13,
    color: '#605e5c',
    lineHeight: 19
  },

  // Alt Buton Alanı (Köşeli, daha yukarıda)
  bottomSection: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 90 : 72,
    backgroundColor: '#fafafa'
  },
  btnStartWrapper: {
    width: '100%'
  },
  btnStart: {
    backgroundColor: '#107c41',
    height: 52,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#107c41',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3
  },
  btnStartText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 16,
    color: '#ffffff',
    letterSpacing: 0.2
  }
});
