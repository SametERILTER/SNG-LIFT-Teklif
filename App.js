import React, { useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Platform, AppState, Appearance, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';
import HomeScreen from './src/screens/HomeScreen';
import CreateProposalScreen from './src/screens/CreateProposalScreen';
import AllProposalsScreen from './src/screens/AllProposalsScreen';
import ProposalSuccessScreen from './src/screens/ProposalSuccessScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import EconomyNewsScreen from './src/screens/EconomyNewsScreen';
import NewsDetailScreen from './src/screens/NewsDetailScreen';
import { fetchLiveRates } from './src/utils/currencyService';
import * as SplashScreen from 'expo-splash-screen';

// Uygulama hazır olana kadar yerel splash ekranının kaybolmasını engelle
SplashScreen.preventAutoHideAsync().catch(() => {});

// Telefon Koyu Modda olsa bile uygulamanın her zaman Açık Modda (Siyah tuşlar, beyaz zemin) çalışmasını zorunlu kıl
if (Appearance && Appearance.setColorScheme) {
  try {
    Appearance.setColorScheme('light');
  } catch (e) {}
}

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
      fetchLiveRates().catch(() => {});
    }
  }, [fontsLoaded]);

  const configureNavBar = useCallback(() => {
    if (Platform.OS === 'android') {
      try {
        if (NavigationBar && NavigationBar.setStyle) {
          NavigationBar.setStyle('dark'); // Navigation bar tuşlarını siyah (dark content) yapar
        }
        if (NavigationBar && NavigationBar.setHidden) {
          NavigationBar.setHidden(false);
        }
      } catch (err) {}
    }
  }, []);

  useEffect(() => {
    // 1. Uygulama ilk açıldığında çalıştır
    configureNavBar();

    // 2. Splash screen sonrası ve arka plandan dönüşte tetikle
    const t1 = setTimeout(configureNavBar, 150);
    const t2 = setTimeout(configureNavBar, 600);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        configureNavBar();
      }
    });

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      subscription?.remove();
    };
  }, [configureNavBar]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#107c41', justifyContent: 'center', alignItems: 'center' }}>
        <NavigationBar style="dark" hidden={false} />
        <StatusBar style="light" backgroundColor="#107c41" translucent={false} />
        <Image
          source={require('./assets/splashScreen.png')}
          style={{ width: 220, height: 220, resizeMode: 'contain' }}
        />
        <ActivityIndicator size="small" color="#ffffff" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <>
      <NavigationBar style="dark" hidden={false} />
      <StatusBar style="dark" backgroundColor="#fafafaff" translucent={false} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#fafafaff' },
            animation: 'slide_from_right',
            animationDuration: 280,
            gestureEnabled: true
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CreateProposal" component={CreateProposalScreen} />
          <Stack.Screen name="AllProposals" component={AllProposalsScreen} />
          <Stack.Screen name="ProposalSuccess" component={ProposalSuccessScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
          <Stack.Screen name="EconomyNews" component={EconomyNewsScreen} />
          <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
