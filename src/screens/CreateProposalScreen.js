import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  FlatList,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  findNodeHandle,
  Image,
  Pressable
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  SlideInRight,
  SlideOutRight,
  LinearTransition,
  Easing,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withTiming
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS, STORAGE_KEY, LAST_TEKLIF_NO_KEY, SETTINGS_KEY } from '../constants/theme';
import { MOTOR_LIST } from '../data/motors';
import { getMotorImage, getMotorImageKey, AVAILABLE_MOTOR_IMAGE_KEYS, MOTOR_IMAGES } from '../data/motorImages';
import { generateProposalHTML, exportAndSharePDF } from '../utils/pdfGenerator';
import { useScreenTransition } from '../utils/useScreenTransition';
import { fetchLiveRates, getCachedRates } from '../utils/currencyService';
import * as ImagePicker from 'expo-image-picker';
import ProposalPreviewModal from '../components/ProposalPreviewModal';
import ProposalCalculatorModal from '../components/ProposalCalculatorModal';
import { APP_COMPANY_CONFIG } from '../config';
import MorphingSuccessButton from '../components/MorphingSuccessButton';

const STATUSBAR_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const HEADER_HEIGHT = Platform.OS === 'android' ? STATUSBAR_H + 98 : 108;
const COLLAPSE_AMOUNT = 36;
const SCROLL_DISTANCE = 110;

export default function CreateProposalScreen({ navigation }) {
  const { animatedStyle, handleGoBack } = useScreenTransition(navigation);
  const inputRefs = useRef({});
  const scrollViewRef = useRef(null);
  const morphButtonRef = useRef(null);


  // Sol Üst Ana Sayfa (Geri) butonu basma animasyonu (Yaylanmasız, pürüzsüz)
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

  // Önizle & Düzenle butonu basma animasyonu
  const previewScale = useSharedValue(1);
  const previewOpacity = useSharedValue(1);
  const previewAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: previewScale.value }],
    opacity: previewOpacity.value
  }));
  const handlePreviewPressIn = () => {
    previewScale.value = withTiming(0.96, { duration: 110, easing: Easing.out(Easing.quad) });
    previewOpacity.value = withTiming(0.9, { duration: 110, easing: Easing.out(Easing.quad) });
  };
  const handlePreviewPressOut = () => {
    previewScale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    previewOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  };

  // PDF Oluştur butonu basma animasyonu
  const pdfScale = useSharedValue(1);
  const pdfOpacity = useSharedValue(1);
  const pdfAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pdfScale.value }],
    opacity: pdfOpacity.value
  }));
  const handlePdfPressIn = () => {
    if (isProcessing) return;
    pdfScale.value = withTiming(0.96, { duration: 110, easing: Easing.out(Easing.quad) });
    pdfOpacity.value = withTiming(0.9, { duration: 110, easing: Easing.out(Easing.quad) });
  };
  const handlePdfPressOut = () => {
    pdfScale.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    pdfOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
  };

  // --- SCROLL KAYDIRMAYA BAĞLI DİNAMİK HEADER ANİMASYONLARI (100% GPU TRANSFORM - 0 LAYOUT PASS) ---
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  // 1. Header'ı yukarı kaydırarak alttan kısaltma (GPU Transform - Sıfır Layout Yükü)
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

  // 3. Büyük "Yeni Teklif Hazırla" başlığının süzülerek kaybolması
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

  // 5. Küçük "Yeni Teklif Hazırla" başlığının yumuşakça belirmesi (GPU Opacity & Transform)
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

  const scrollToInput = (key) => {
    setTimeout(() => {
      const target = inputRefs.current && inputRefs.current[key];
      if (!target || !scrollViewRef.current) return;
      try {
        const scrollResponder = scrollViewRef.current.getScrollResponder ? scrollViewRef.current.getScrollResponder() : null;
        const node = findNodeHandle(target);
        if (scrollResponder && scrollResponder.scrollResponderScrollNativeHandleToKeyboard && node) {
          scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
            node,
            240, // Klavyenin hemen dibinde kalmaması için yukarı doğru konforlu boşluk (240px)
            true
          );
        } else if (target.measureLayout && scrollViewRef.current) {
          const scrollNode = findNodeHandle(scrollViewRef.current) || scrollViewRef.current;
          target.measureLayout(
            scrollNode,
            (x, y) => {
              scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 200), animated: true });
            },
            () => { }
          );
        }
      } catch (err) {
        // fallback
      }
    }, 100);
  };

  const handleInputFocus = (key) => {
    setFocusedInput(key);
    scrollToInput(key);
  };

  const focusNextField = (key) => {
    const target = inputRefs.current && inputRefs.current[key];
    if (target) {
      target.focus();
      scrollToInput(key);
    }
  };

  // --- DÖVİZ KURLARI (Yedekli ve Önbellekli Servis) ---
  const [rates, setRates] = useState({ usd: null, eur: null, loading: true });

  useEffect(() => {
    let isMounted = true;

    // 1. Önce önbellekteki kurları hemen yükle (Gecikmesiz görünüm)
    getCachedRates().then((cached) => {
      if (isMounted && cached && cached.usd && cached.eur) {
        setRates((prev) => ({ ...prev, usd: cached.usd, eur: cached.eur }));
      }
    });

    // 2. Canlı güncel kurları arka planda çek ve güncelle
    fetchLiveRates().then((live) => {
      if (isMounted && live && live.usd && live.eur) {
        setRates({ usd: live.usd, eur: live.eur, loading: false });
      } else if (isMounted) {
        setRates((prev) => ({ ...prev, loading: false }));
      }
    }).catch(() => {
      if (isMounted) setRates((prev) => ({ ...prev, loading: false }));
    });

    return () => { isMounted = false; };
  }, []);

  // --- MÜŞTERİ VE TEKLİF BİLGİLERİ ---
  const [clientFirma, setClientFirma] = useState('');
  const [clientYetkili, setClientYetkili] = useState('');
  const [clientRef, setClientRef] = useState('');
  const [teklifTarih, setTeklifTarih] = useState(() => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  });
  const [teklifNo, setTeklifNo] = useState('1001');
  const [currency, setCurrency] = useState('USD'); // 'USD' | 'TL' | 'EUR'
  const [teslimSuresi, setTeslimSuresi] = useState('STOK');
  const [odemeBilgisi, setOdemeBilgisi] = useState('NAKİT');
  const [kdvRate, setKdvRate] = useState(20.0);
  const [vendorInfo, setVendorInfo] = useState({
    firma: APP_COMPANY_CONFIG.companyName,
    yetkili: APP_COMPANY_CONFIG.vendorYetkili,
    tel: APP_COMPANY_CONFIG.tel,
    email: APP_COMPANY_CONFIG.email,
    ref: APP_COMPANY_CONFIG.ref
  });
  const [bankInfo, setBankInfo] = useState({
    bankAccountTitle: APP_COMPANY_CONFIG.bankAccountTitle,
    garantiIban: APP_COMPANY_CONFIG.garantiIban,
    vakifIban: APP_COMPANY_CONFIG.vakifIban,
    ziraatIban: APP_COMPANY_CONFIG.ziraatIban,
    garantiUsdIban: APP_COMPANY_CONFIG.garantiUsdIban,
    vakifUsdIban: APP_COMPANY_CONFIG.vakifUsdIban,
    ziraatUsdIban: APP_COMPANY_CONFIG.ziraatUsdIban
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);
  const [currentProposalId, setCurrentProposalId] = useState(null);
  const [currentSavedRecord, setCurrentSavedRecord] = useState(null);

  // Sıralı Teklif Numarasını Yükle (AsyncStorage ve geçmiş tekliflerdeki en yüksek numaradan türetir)
  const fetchNextTeklifNo = useCallback(async () => {
    try {
      let maxNo = 1000;
      const lastSavedNo = await AsyncStorage.getItem(LAST_TEKLIF_NO_KEY);
      if (lastSavedNo) {
        const parsed = parseInt(lastSavedNo, 10);
        if (!isNaN(parsed) && parsed > maxNo) {
          maxNo = parsed;
        }
      }
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) {
          for (const item of list) {
            const rawNo = item.teklifNo || item.payload?.teklifNo;
            const num = parseInt(rawNo, 10);
            if (!isNaN(num) && num > maxNo) {
              maxNo = num;
            }
          }
        }
      }
      const nextNo = String(maxNo + 1);
      setTeklifNo(nextNo);
      return nextNo;
    } catch {
      setTeklifNo('1001');
      return '1001';
    }
  }, []);

  // Rastgele 4 basamaklı Teklif Numarası Üret
  const generateRandomTeklifNo = useCallback(() => {
    let newNo;
    const currentNum = parseInt(teklifNo, 10);
    do {
      newNo = Math.floor(1000 + Math.random() * 9000);
    } while (newNo === currentNum);
    setTeklifNo(String(newNo));
  }, [teklifNo]);

  useEffect(() => {
    const loadDefaultSettings = async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.defaultKdv) setKdvRate(parseFloat(parsed.defaultKdv) || 20.0);
          if (parsed.companyName) setVendorInfo(prev => ({ ...prev, firma: parsed.companyName }));
          if (parsed.representative) setVendorInfo(prev => ({ ...prev, yetkili: parsed.representative }));
          if (parsed.phone) setVendorInfo(prev => ({ ...prev, tel: parsed.phone }));
          if (parsed.email) setVendorInfo(prev => ({ ...prev, email: parsed.email }));
          if (parsed.bankAccountTitle) setBankInfo(prev => ({ ...prev, bankAccountTitle: parsed.bankAccountTitle }));
          if (parsed.garantiIban) setBankInfo(prev => ({ ...prev, garantiIban: parsed.garantiIban }));
          if (parsed.vakifIban) setBankInfo(prev => ({ ...prev, vakifIban: parsed.vakifIban }));
          if (parsed.ziraatIban) setBankInfo(prev => ({ ...prev, ziraatIban: parsed.ziraatIban }));
          if (parsed.garantiUsdIban) setBankInfo(prev => ({ ...prev, garantiUsdIban: parsed.garantiUsdIban }));
          if (parsed.vakifUsdIban) setBankInfo(prev => ({ ...prev, vakifUsdIban: parsed.vakifUsdIban }));
          if (parsed.ziraatUsdIban) setBankInfo(prev => ({ ...prev, ziraatUsdIban: parsed.ziraatUsdIban }));
        }
      } catch (e) {
        // ignore
      }
    };

    fetchNextTeklifNo();
    loadDefaultSettings();
  }, [fetchNextTeklifNo]);

  // Ekrana her dönüldüğünde butonu ilk haline getir ve gerekirse sıradaki teklif numarasını tazele
  useFocusEffect(
    useCallback(() => {
      morphButtonRef.current?.reset();
      if (!currentProposalId && !clientFirma.trim()) {
        fetchNextTeklifNo();
      }
    }, [currentProposalId, clientFirma, fetchNextTeklifNo])
  );

  // --- UYGULAMA İÇİ ÖNİZLEME MODALI ---
  const [previewVisible, setPreviewVisible] = useState(false);
  const [calcModalVisible, setCalcModalVisible] = useState(false);

  // --- AKORDİYON DURUMU (Hangi malzeme açık?) ---
  const [expandedIndex, setExpandedIndex] = useState(0);

  // --- SEÇİM MODALLARI ---
  const [pickerModalVisible, setPickerModalVisible] = useState(false);
  const [pickerType, setPickerType] = useState(null); // 'model' | 'aski'
  const [activeItemIndex, setActiveItemIndex] = useState(null);

  // --- DİNAMİK MALZEME LİSTESİ ---
  const [items, setItems] = useState([]);

  // Malzeme Genişlet / Daralt
  const toggleExpand = (index) => {
    setExpandedIndex(prev => (prev === index ? null : index));
  };

  // Yeni Malzeme Ekle
  const addItem = () => {
    if (items.length >= 30) {
      Alert.alert('Sınır Aşıldı', 'En fazla 30 malzeme ekleyebilirsiniz.');
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      model: '',
      kg: '',
      hiz: '',
      aski: '',
      kasnak: '',
      kw: '',
      amp: '',
      detail: '',
      motorImageKey: '',
      qty: '1',
      price: ''
    };
    setItems(prev => {
      const nextList = [...prev, newItem];
      setExpandedIndex(nextList.length - 1);
      return nextList;
    });
  };

  // Malzeme Alanını Güncelle
  const updateItem = (index, field, value) => {
    setItems(prev => {
      const updated = [...prev];
      if (field === 'model') {
        updated[index] = { ...updated[index], model: (value || '').toUpperCase() };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // Miktar Artır/Azalt
  const adjustQty = (index, amount) => {
    setItems(prev => {
      const updated = [...prev];
      const current = parseFloat(updated[index].qty || '0');
      const nextVal = Math.max(1, current + amount);
      updated[index].qty = String(nextVal);
      return updated;
    });
  };

  // Malzeme Sil
  const deleteItem = (index) => {
    setItems(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      if (expandedIndex === index) {
        setExpandedIndex(filtered.length > 0 ? Math.max(0, index - 1) : null);
      } else if (expandedIndex > index) {
        setExpandedIndex(expandedIndex - 1);
      }
      return filtered;
    });
  };

  // Tümünü Sil
  const clearAllItems = () => {
    if (items.length === 0) return;
    Alert.alert('Tümünü Sil', 'Tüm malzemeleri silmek istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => setItems([])
      }
    ]);
  };

  // Canlı Toplam Hesaplamaları
  const subtotal = items.reduce((sum, it) => {
    const q = parseFloat(it.qty) || 0;
    const p = parseFloat(it.price) || 0;
    return sum + (q * p);
  }, 0);
  const kdv = subtotal * (kdvRate / 100.0);
  const grandTotal = subtotal + kdv;

  const formatUSD = (val) => {
    const sym = currency === 'TL' ? '₺ ' : currency === 'EUR' ? '€ ' : '$ ';
    return sym + Number(val || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Teklif Veri Paketi Oluşturucu
  const getProposalPayload = () => ({
    teklifNo,
    tarih: teklifTarih,
    clientFirma: clientFirma.trim(),
    clientYetkili: clientYetkili.trim(),
    clientRef: clientRef.trim(),
    currency,
    items: [...items],
    teslimSuresi: teslimSuresi.trim() || 'STOK',
    odemeBilgisi: odemeBilgisi.trim() || 'NAKİT',
    vendorFirma: vendorInfo.firma || APP_COMPANY_CONFIG.companyName,
    vendorYetkili: vendorInfo.yetkili || APP_COMPANY_CONFIG.vendorYetkili,
    vendorTel: vendorInfo.tel || APP_COMPANY_CONFIG.tel,
    vendorEmail: vendorInfo.email || APP_COMPANY_CONFIG.email,
    vendorRef: vendorInfo.ref || APP_COMPANY_CONFIG.ref,
    bankAccountTitle: bankInfo.bankAccountTitle || APP_COMPANY_CONFIG.bankAccountTitle,
    garantiIban: bankInfo.garantiIban || APP_COMPANY_CONFIG.garantiIban,
    vakifIban: bankInfo.vakifIban || APP_COMPANY_CONFIG.vakifIban,
    ziraatIban: bankInfo.ziraatIban || APP_COMPANY_CONFIG.ziraatIban,
    garantiUsdIban: bankInfo.garantiUsdIban || APP_COMPANY_CONFIG.garantiUsdIban,
    vakifUsdIban: bankInfo.vakifUsdIban || APP_COMPANY_CONFIG.vakifUsdIban,
    ziraatUsdIban: bankInfo.ziraatUsdIban || APP_COMPANY_CONFIG.ziraatUsdIban,
    kdvRate,
    grandTotal
  });

  // Teklifi Yerel Veritabanına (AsyncStorage) Kaydet / Güncelle
  const saveProposalRecord = async () => {
    if (!clientFirma.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen müşteri firma adını giriniz.');
      return null;
    }
    if (items.length === 0) {
      Alert.alert('Eksik Bilgi', 'Lütfen en az 1 malzeme kalemi ekleyiniz.');
      return null;
    }

    const payload = getProposalPayload();
    const recordId = currentProposalId || Date.now().toString();

    const recordToSave = {
      ...(currentSavedRecord || {}),
      id: recordId,
      teklifNo: payload.teklifNo,
      tarih: payload.tarih,
      firma: payload.clientFirma,
      yetkili: payload.clientYetkili,
      clientRef: payload.clientRef,
      currency: payload.currency,
      itemCount: payload.items.length,
      grandTotal: payload.grandTotal,
      payload: payload
    };

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      const existingIndex = existing.findIndex(it => String(it.id) === String(recordId));
      let updatedHistory;
      if (existingIndex >= 0) {
        updatedHistory = existing.map(it => String(it.id) === String(recordId) ? recordToSave : it);
      } else {
        updatedHistory = [recordToSave, ...existing];
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));

      // Son Teklif Numarasını AsyncStorage'a kaydet
      const parsedNum = parseInt(payload.teklifNo, 10);
      if (!isNaN(parsedNum)) {
        await AsyncStorage.setItem(LAST_TEKLIF_NO_KEY, String(parsedNum));
      }

      setCurrentProposalId(recordId);
      setCurrentSavedRecord(recordToSave);
      return recordToSave;
    } catch (err) {
      console.log('Kaydetme hatası:', err);
      Alert.alert('Hata', 'Teklif kaydedilirken bir sorun oluştu.');
      return null;
    }
  };

  // UYGULAMA İÇİ ÖNİZLEME AÇ (Önce veritabanına kaydeder/günceller, böylece ana ekranda görünür)
  const handleOpenInAppPreview = async () => {
    const savedRecord = await saveProposalRecord();
    if (savedRecord) {
      setPreviewVisible(true);
    }
  };

  // PDF Olarak Kaydet ve Başarı Ekranına Geç Aksiyonu
  const handleSaveAndSharePDF = async () => {
    setIsProcessing(true);
    const savedRecord = await saveProposalRecord();
    if (!savedRecord) {
      setIsProcessing(false);
      return false;
    }

    // Başarı rozetinin tamamlanıp keyifle görülmesi için ~550ms bekle ve yönlendir
    setTimeout(() => {
      setIsProcessing(false);
      navigation.navigate('ProposalSuccess', { proposalRecord: savedRecord });
    }, 550);

    return true;
  };

  // Önizleme modalında yapılan canlı düzenlemeleri CreateProposalScreen formuna da senkronize et
  const handleRecordUpdatedFromPreview = (updatedRecord) => {
    if (!updatedRecord) return;
    setCurrentSavedRecord(updatedRecord);
    if (updatedRecord.id) {
      setCurrentProposalId(updatedRecord.id);
    }
    const p = updatedRecord.payload || updatedRecord;
    if (p.clientFirma !== undefined) setClientFirma(p.clientFirma);
    if (p.clientYetkili !== undefined) setClientYetkili(p.clientYetkili);
    if (p.clientRef !== undefined) setClientRef(p.clientRef);
    if (p.tarih !== undefined) setTeklifTarih(p.tarih);
    if (p.teklifNo !== undefined) setTeklifNo(p.teklifNo);
    if (p.currency !== undefined) setCurrency(p.currency);
    if (p.items && Array.isArray(p.items)) setItems(p.items);
    if (p.teslimSuresi !== undefined) setTeslimSuresi(p.teslimSuresi);
    if (p.odemeBilgisi !== undefined) setOdemeBilgisi(p.odemeBilgisi);
    if (p.kdvRate !== undefined) setKdvRate(p.kdvRate);
  };

  // Model & Askı Seçimi Aç
  const openPicker = (type, itemIndex) => {
    setPickerType(type);
    setActiveItemIndex(itemIndex);
    setPickerModalVisible(true);
  };

  const selectPickerValue = (val) => {
    if (activeItemIndex !== null && pickerType) {
      if (pickerType === 'model') {
        updateItem(activeItemIndex, 'model', val);
      } else if (pickerType === 'motorImage') {
        updateItem(activeItemIndex, 'motorImageKey', val === 'NONE' ? '' : val);
      } else {
        updateItem(activeItemIndex, pickerType, val);
      }
    }
    setPickerModalVisible(false);
  };

  // Galeriden Fotoğraf Seçme
  const pickImageFromGallery = async () => {
    const targetIndex = activeItemIndex;
    setPickerModalVisible(false);

    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('İzin Gerekli', 'Galeriden fotoğraf seçebilmek için galeri erişim izni vermeniz gerekmektedir.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.35,
        base64: true
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
        if (targetIndex !== null) {
          updateItem(targetIndex, 'motorImageKey', base64Uri);
        }
      }
    } catch (err) {
      console.log('Galeri seçim hatası:', err);
      Alert.alert('Hata', 'Galeriden fotoğraf seçilirken bir sorun oluştu.');
    }
  };

  return (
    <Animated.View style={[styles.rootContainer, animatedStyle]}>
      <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

      {/* 1. ÜST YEŞİL KURUMSAL BAŞLIK BARI (GPU HIZLANDIRMALI 0-LAG DİNAMİK HEADER) */}
      <Animated.View style={[styles.topGreenHeader, headerAnimatedStyle]}>
        <SafeAreaView>
          {/* Üst Satır: (Geri Butonu + Yanındaki Dinamik Başlık) + (Döviz Kurları & Hesap Makinesi) */}
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

              {/* Dinamik Başlık Alanı (Ana Sayfa -> Yeni Teklif Hazırla Crossfade) */}
              <View style={styles.headerTitleSwapContainer}>
                {/* 1. Scroll Edilmemişken: "Ana Sayfa" */}
                <Animated.View style={[styles.titleSwapItem, backTextAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.btnBackText} numberOfLines={1}>Ana Sayfa</Text>
                </Animated.View>

                {/* 2. Scroll Edilince: "Yeni Teklif Hazırla" */}
                <Animated.View style={[styles.titleSwapItem, smallTitleAnimatedStyle]} pointerEvents="none">
                  <Text style={styles.smallHeaderTitleText} numberOfLines={1} ellipsizeMode="tail">
                    Yeni Teklif Hazırla
                  </Text>
                </Animated.View>
              </View>
            </View>

            {/* Sağ Üst Canlı Kurlar ve Hemen Sağında Hesap Makinesi */}
            <View style={styles.topHeaderRightBox}>
              <View style={styles.ratesContainer}>
                <View style={styles.rateItem}>
                  <Text style={styles.rateSymbol}>$</Text>
                  <Text style={styles.rateValue}>{rates.usd ? `${rates.usd} ₺` : '...'}</Text>
                </View>
                <Text style={styles.rateSeparator}>|</Text>
                <View style={styles.rateItem}>
                  <Text style={styles.rateSymbol}>€</Text>
                  <Text style={styles.rateValue}>{rates.eur ? `${rates.eur} ₺` : '...'}</Text>
                </View>
              </View>

              {/* Hesap Makinesi Butonu (Döviz Kurlarının Hemen Sağında) */}
              <TouchableOpacity
                style={styles.btnCalcHeaderTop}
                onPress={() => setCalcModalVisible(true)}
                activeOpacity={0.65}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="calculator-outline" size={19} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Alt Satır: "Yeni Teklif Hazırla" (Scroll ile yukarı doğru süzülerek kaybolur) */}
          <Animated.View style={[styles.titleRowContainer, titleRowAnimatedStyle]}>
            <Text style={styles.pageHeaderTitle} numberOfLines={1}>Yeni Teklif Hazırla</Text>
          </Animated.View>
        </SafeAreaView>
      </Animated.View>

      {/* 2. İÇERİK FORMU (KUTUSUZ & FERAH DÜZEN) */}
      <View style={styles.bodyContainer}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingTop: HEADER_HEIGHT + 14 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews={Platform.OS === 'android'}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* A) MÜŞTERİ & TEKLİF DETAYLARI */}
            <Animated.View
              entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
              style={styles.sectionBlock}
            >
              <Text style={styles.sectionHeaderTitle}>MÜŞTERİ & TEKLİF DETAYLARI</Text>

              {/* PARA BİRİMİ / ŞABLON SEÇİMİ (USD, TL, EUR) */}
              <View style={styles.currencySection}>
                <Text style={styles.fieldLabel}>Teklif Para Birimi</Text>
                <View style={styles.currencySegmentContainer}>
                  <TouchableOpacity
                    style={[
                      styles.currencySegmentBtn,
                      currency === 'USD' && styles.currencySegmentBtnActive
                    ]}
                    onPress={() => setCurrency('USD')}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="logo-usd"
                      size={15}
                      color={currency === 'USD' ? '#ffffff' : '#1e293b'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.currencySegmentText, currency === 'USD' && styles.currencySegmentTextActive]}>
                      USD ($)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.currencySegmentBtn,
                      currency === 'TL' && styles.currencySegmentBtnActive
                    ]}
                    onPress={() => setCurrency('TL')}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.currencySymbolBadge, currency === 'TL' && styles.currencySymbolBadgeActive]}>₺</Text>
                    <Text style={[styles.currencySegmentText, currency === 'TL' && styles.currencySegmentTextActive]}>
                      TL (₺)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.currencySegmentBtn,
                      styles.currencySegmentBtnLast,
                      currency === 'EUR' && styles.currencySegmentBtnActive
                    ]}
                    onPress={() => setCurrency('EUR')}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name="logo-euro"
                      size={15}
                      color={currency === 'EUR' ? '#ffffff' : '#1e293b'}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.currencySegmentText, currency === 'EUR' && styles.currencySegmentTextActive]}>
                      EUR (€)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Firma Adı</Text>
                <TextInput
                  ref={(r) => (inputRefs.current['clientFirma'] = r)}
                  style={[styles.textInput, focusedInput === 'clientFirma' && styles.inputFocused]}
                  placeholder="Müşteri Firma Adı"
                  placeholderTextColor={MS.textMuted}
                  value={clientFirma}
                  onChangeText={setClientFirma}
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextField('clientYetkili')}
                  onFocus={() => handleInputFocus('clientFirma')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Yetkili Kişi</Text>
                <TextInput
                  ref={(r) => (inputRefs.current['clientYetkili'] = r)}
                  style={[styles.textInput, focusedInput === 'clientYetkili' && styles.inputFocused]}
                  placeholder="İlgili Kişi Adı"
                  placeholderTextColor={MS.textMuted}
                  value={clientYetkili}
                  onChangeText={setClientYetkili}
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextField('clientRef')}
                  onFocus={() => handleInputFocus('clientYetkili')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={styles.inputField}>
                <Text style={styles.fieldLabel}>Referans (İsteğe Bağlı)</Text>
                <TextInput
                  ref={(r) => (inputRefs.current['clientRef'] = r)}
                  style={[styles.textInput, focusedInput === 'clientRef' && styles.inputFocused]}
                  placeholder="Referans bilgisi ekleyin"
                  placeholderTextColor={MS.textMuted}
                  value={clientRef}
                  onChangeText={setClientRef}
                  returnKeyType="next"
                  onSubmitEditing={() => focusNextField('teklifTarih')}
                  onFocus={() => handleInputFocus('clientRef')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={styles.rowTwoCols}>
                <View style={[styles.inputField, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.fieldLabel}>Teklif Tarihi</Text>
                  <TextInput
                    ref={(r) => (inputRefs.current['teklifTarih'] = r)}
                    style={[styles.textInput, focusedInput === 'teklifTarih' && styles.inputFocused]}
                    value={teklifTarih}
                    onChangeText={setTeklifTarih}
                    placeholder="GG.AA.YYYY"
                    placeholderTextColor={MS.textMuted}
                    returnKeyType="next"
                    onSubmitEditing={() => focusNextField('teklifNo')}
                    onFocus={() => handleInputFocus('teklifTarih')}
                    onBlur={() => setFocusedInput(null)}
                  />
                </View>

                <View style={[styles.inputField, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.fieldLabel}>Teklif No</Text>
                  <View style={styles.inputWithButton}>
                    <TextInput
                      ref={(r) => (inputRefs.current['teklifNo'] = r)}
                      style={[styles.textInput, { flex: 1 }, focusedInput === 'teklifNo' && styles.inputFocused]}
                      value={teklifNo}
                      onChangeText={setTeklifNo}
                      keyboardType="numeric"
                      placeholder="4829"
                      placeholderTextColor={MS.textMuted}
                      returnKeyType="next"
                      onSubmitEditing={() => focusNextField('0-model')}
                      onFocus={() => handleInputFocus('teklifNo')}
                      onBlur={() => setFocusedInput(null)}
                    />
                    <TouchableOpacity
                      style={styles.btnInlineRefresh}
                      onPress={generateRandomTeklifNo}
                      onLongPress={fetchNextTeklifNo}
                      activeOpacity={0.7}
                      accessibilityLabel="Rastgele Teklif Numarası Üret"
                    >
                      <Ionicons name="shuffle-outline" size={17} color={MS.accent} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* B) MALZEME LİSTESİ */}
            <Animated.View
              entering={FadeInDown.delay(70).duration(260).easing(Easing.out(Easing.cubic))}
              style={styles.sectionBlock}
            >
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>TEKLİF EDİLEN MALZEMELER</Text>

                {items.length > 0 && (
                  <TouchableOpacity
                    style={styles.btnClearAll}
                    onPress={clearAllItems}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.btnClearAllText}>Tümünü Sil</Text>
                  </TouchableOpacity>
                )}
              </View>

              {items.length === 0 ? (
                <View style={styles.emptyItemsState}>
                  <Ionicons name="cube-outline" size={32} color={MS.borderLight} style={{ marginBottom: 6 }} />
                  <Text style={styles.emptyItemsTitle}>Henüz Malzeme Eklenmedi</Text>
                  <Text style={styles.emptyItemsDesc}>
                    Aşağıdaki butona dokunarak motor kalemi ekleyebilirsiniz.
                  </Text>
                </View>
              ) : (
                <View style={styles.materialsListWrapper}>
                  {items.map((item, index) => {
                    const isExpanded = expandedIndex === index;
                    const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
                    const displayTitle = item.model ? `FURDER ${item.model}` : 'Model Seçilmedi';
                    const isLast = index === items.length - 1;

                    return (
                      <Animated.View
                        key={item.id}
                        layout={LinearTransition.duration(260).easing(Easing.inOut(Easing.ease))}
                        style={[styles.materialsItemContainer, !isLast && styles.listRowDivider]}
                      >
                        {/* 1. Kompakt Özet Satırı */}
                        <TouchableOpacity
                          style={[styles.listRowItem, isExpanded && { backgroundColor: '#fcfcfc' }]}
                          onPress={() => toggleExpand(index)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.listRowCenter}>
                            <Text style={styles.listRowTitle} numberOfLines={1}>{displayTitle}</Text>
                            <Text style={styles.listRowSubtitle} numberOfLines={1}>
                              {item.qty || 1} Adet • {item.price ? formatUSD(itemTotal) : 'Fiyat Belirtilmedi'}
                            </Text>
                          </View>

                          <View style={styles.listRowActions}>
                            <TouchableOpacity
                              style={styles.btnRowDelete}
                              onPress={() => deleteItem(index)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="trash-outline" size={16} color={MS.danger} />
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={[styles.btnRowEdit, isExpanded && styles.btnRowEditActive]}
                              onPress={() => toggleExpand(index)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name={isExpanded ? "chevron-up" : "pencil-outline"} size={13} color={isExpanded ? MS.primary : MS.accent} style={{ marginRight: 3 }} />
                              <Text style={[styles.btnRowEditText, isExpanded && { color: MS.primary }]}>
                                {isExpanded ? "Kapat" : "Düzenle"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>

                        {/* 2. Açılan Düzenleme Formu (Animasyonlu) */}
                        {isExpanded && (
                          <Animated.View
                            entering={FadeInDown.duration(260).easing(Easing.out(Easing.cubic))}
                            exiting={FadeOutUp.duration(260).easing(Easing.in(Easing.cubic))}
                            layout={LinearTransition.duration(260).easing(Easing.inOut(Easing.ease))}
                            style={styles.listExpandedInner}
                          >
                            {/* Giriş Alanları (Sıralama: Model -> Kapasite -> Hız -> Askı -> Kasnak -> Güç -> Akım -> Fiyat) */}
                            <View style={styles.gridContainer}>
                              {/* 1. MOTOR MODELİ */}
                              <View style={styles.gridField}>
                                <Text style={styles.fieldLabel}>Motor Modeli</Text>
                                <View style={styles.comboInputContainer}>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-model`] = r)}
                                    style={[styles.comboTextInput, focusedInput === `${index}-model` && styles.inputFocused]}
                                    placeholder="Model yaz veya seç..."
                                    autoCapitalize="characters"
                                    placeholderTextColor={MS.textMuted}
                                    value={item.model}
                                    onChangeText={(v) => updateItem(index, 'model', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-kg`)}
                                    onFocus={() => handleInputFocus(`${index}-model`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                  <TouchableOpacity
                                    style={styles.btnComboDropdown}
                                    onPress={() => openPicker('model', index)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="chevron-down" size={16} color={MS.textSecondary} />
                                  </TouchableOpacity>
                                </View>
                              </View>

                              {/* 2. KAPASİTE & 3. HIZ */}
                              <View style={styles.gridRow}>
                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Kapasite (Kg)</Text>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-kg`] = r)}
                                    style={[styles.fieldInput, focusedInput === `${index}-kg` && styles.inputFocused]}
                                    placeholder="Örn: 1000"
                                    placeholderTextColor={MS.textMuted}
                                    keyboardType="numeric"
                                    value={item.kg}
                                    onChangeText={(v) => updateItem(index, 'kg', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-hiz`)}
                                    onFocus={() => handleInputFocus(`${index}-kg`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                </View>

                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Hız (m/s)</Text>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-hiz`] = r)}
                                    style={[styles.fieldInput, focusedInput === `${index}-hiz` && styles.inputFocused]}
                                    placeholder="Örn: 1.75"
                                    placeholderTextColor={MS.textMuted}
                                    keyboardType="numeric"
                                    value={item.hiz}
                                    onChangeText={(v) => updateItem(index, 'hiz', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-aski`)}
                                    onFocus={() => handleInputFocus(`${index}-hiz`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                </View>
                              </View>

                              {/* 4. ASKI ŞEKLİ & 5. KASNAK */}
                              <View style={styles.gridRow}>
                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Askı Şekli</Text>
                                  <View style={styles.comboInputContainer}>
                                    <TextInput
                                      ref={(r) => (inputRefs.current[`${index}-aski`] = r)}
                                      style={[styles.comboTextInput, focusedInput === `${index}-aski` && styles.inputFocused]}
                                      placeholder="Örn: 2:1"
                                      placeholderTextColor={MS.textMuted}
                                      value={item.aski}
                                      onChangeText={(v) => updateItem(index, 'aski', v)}
                                      returnKeyType="next"
                                      onSubmitEditing={() => focusNextField(`${index}-kasnak`)}
                                      onFocus={() => handleInputFocus(`${index}-aski`)}
                                      onBlur={() => setFocusedInput(null)}
                                    />
                                    <TouchableOpacity
                                      style={styles.btnComboDropdown}
                                      onPress={() => openPicker('aski', index)}
                                      activeOpacity={0.7}
                                    >
                                      <Ionicons name="chevron-down" size={16} color={MS.textSecondary} />
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Kasnak (mm)</Text>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-kasnak`] = r)}
                                    style={[styles.fieldInput, focusedInput === `${index}-kasnak` && styles.inputFocused]}
                                    placeholder="Örn: 400*5x10"
                                    placeholderTextColor={MS.textMuted}
                                    value={item.kasnak}
                                    onChangeText={(v) => updateItem(index, 'kasnak', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-kw`)}
                                    onFocus={() => handleInputFocus(`${index}-kasnak`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                </View>
                              </View>

                              {/* 6. MOTOR GÜCÜ & 7. AKIM */}
                              <View style={styles.gridRow}>
                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Motor Gücü (kW)</Text>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-kw`] = r)}
                                    style={[styles.fieldInput, focusedInput === `${index}-kw` && styles.inputFocused]}
                                    placeholder="Örn: 11"
                                    placeholderTextColor={MS.textMuted}
                                    keyboardType="numeric"
                                    value={item.kw}
                                    onChangeText={(v) => updateItem(index, 'kw', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-amp`)}
                                    onFocus={() => handleInputFocus(`${index}-kw`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                </View>

                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Akım (Amp)</Text>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-amp`] = r)}
                                    style={[styles.fieldInput, focusedInput === `${index}-amp` && styles.inputFocused]}
                                    placeholder="Örn: 25"
                                    placeholderTextColor={MS.textMuted}
                                    keyboardType="numeric"
                                    value={item.amp}
                                    onChangeText={(v) => updateItem(index, 'amp', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-qty`)}
                                    onFocus={() => handleInputFocus(`${index}-amp`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                </View>
                              </View>

                              {/* MİKTAR & 8. BİRİM FİYAT */}
                              <View style={styles.gridRow}>
                                <View style={styles.gridField}>
                                  <Text style={styles.fieldLabel}>Miktar (Adet)</Text>
                                  <View style={[styles.stepperContainer, focusedInput === `${index}-qty` && styles.inputFocused]}>
                                    <TouchableOpacity
                                      style={styles.btnStep}
                                      onPress={() => adjustQty(index, -1)}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.btnStepText}>−</Text>
                                    </TouchableOpacity>
                                    <TextInput
                                      ref={(r) => (inputRefs.current[`${index}-qty`] = r)}
                                      style={styles.stepperInput}
                                      value={item.qty}
                                      onChangeText={(v) => updateItem(index, 'qty', v)}
                                      keyboardType="numeric"
                                      returnKeyType="next"
                                      onSubmitEditing={() => focusNextField(`${index}-price`)}
                                      onFocus={() => handleInputFocus(`${index}-qty`)}
                                      onBlur={() => setFocusedInput(null)}
                                    />
                                    <TouchableOpacity
                                      style={styles.btnStep}
                                      onPress={() => adjustQty(index, 1)}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.btnStepText}>+</Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>

                                <View style={styles.gridField}>
                                  <Text style={[styles.fieldLabel, { color: MS.accent }]}>
                                    Birim Fiyat ({currency === 'USD' ? '$ USD' : currency === 'EUR' ? '€ EUR' : '₺ TL'})
                                  </Text>
                                  <TextInput
                                    ref={(r) => (inputRefs.current[`${index}-price`] = r)}
                                    style={[styles.fieldInput, styles.fieldInputHighlight, focusedInput === `${index}-price` && styles.inputFocused]}
                                    placeholder="Örn: 1275"
                                    placeholderTextColor={MS.textMuted}
                                    keyboardType="numeric"
                                    value={item.price}
                                    onChangeText={(v) => updateItem(index, 'price', v)}
                                    returnKeyType="next"
                                    onSubmitEditing={() => focusNextField(`${index}-detail`)}
                                    onFocus={() => handleInputFocus(`${index}-price`)}
                                    onBlur={() => setFocusedInput(null)}
                                  />
                                </View>
                              </View>

                              {/* 9. ÜRÜN DETAY BİLGİSİ (İSTEĞE BAĞLI - TEK SATIR) */}
                              <View style={{ marginTop: 10 }}>
                                <Text style={styles.fieldLabel}>Ürün Detay Bilgisi (İsteğe Bağlı)</Text>
                                <TextInput
                                  ref={(r) => (inputRefs.current[`${index}-detail`] = r)}
                                  style={[styles.fieldInput, focusedInput === `${index}-detail` && styles.inputFocused]}
                                  placeholder="Detay bilgisi ekleyin"
                                  placeholderTextColor={MS.textMuted}
                                  value={item.detail || ''}
                                  onChangeText={(v) => updateItem(index, 'detail', v)}
                                  returnKeyType="done"
                                  onSubmitEditing={() => toggleExpand(index)}
                                  onFocus={() => handleInputFocus(`${index}-detail`)}
                                  onBlur={() => setFocusedInput(null)}
                                />
                              </View>

                              {/* 10. MOTOR FOTOĞRAFI / GÖRSELİ (İSTEĞE BAĞLI) */}
                              <View style={styles.motorImageCardSection}>
                                <Text style={styles.fieldLabel}>Motor Görseli (İsteğe Bağlı)</Text>
                                {item.motorImageKey && getMotorImage(item.motorImageKey) ? (
                                  <View style={styles.selectedMotorImageBox}>
                                    <Image
                                      source={getMotorImage(item.motorImageKey)}
                                      style={styles.motorImageThumbnail}
                                      resizeMode="contain"
                                    />
                                    <View style={styles.motorImageInfoCol}>
                                      <Text style={styles.motorImageKeyText} numberOfLines={1}>
                                        {item.motorImageKey && (
                                          item.motorImageKey.startsWith('data:') ||
                                          item.motorImageKey.startsWith('file:') ||
                                          item.motorImageKey.startsWith('content:') ||
                                          item.motorImageKey.length > 50
                                        )
                                          ? (item.model ? `FURDER ${item.model}` : 'Özel Motor Görseli')
                                          : `FURDER ${item.motorImageKey}`}
                                      </Text>
                                      <View style={styles.motorImageActionRow}>
                                        <TouchableOpacity
                                          style={styles.btnChangeImage}
                                          onPress={() => openPicker('motorImage', index)}
                                          activeOpacity={0.7}
                                        >
                                          <Ionicons name="images-outline" size={13} color="#107c41" style={{ marginRight: 4 }} />
                                          <Text style={styles.btnChangeImageText}>Değiştir</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          style={styles.btnRemoveImage}
                                          onPress={() => updateItem(index, 'motorImageKey', '')}
                                          activeOpacity={0.7}
                                        >
                                          <Ionicons name="trash-outline" size={13} color={MS.danger} style={{ marginRight: 4 }} />
                                          <Text style={styles.btnRemoveImageText}>Kaldır</Text>
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  </View>
                                ) : (
                                  <TouchableOpacity
                                    style={styles.btnAddMotorImage}
                                    onPress={() => openPicker('motorImage', index)}
                                    activeOpacity={0.7}
                                  >
                                    <Ionicons name="camera-outline" size={16} color="#107c41" style={{ marginRight: 6 }} />
                                    <Text style={styles.btnAddMotorImageText}>+ Motor Fotoğrafı Ekle (Görsel Seç)</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>

                            {/* Tamamla / Daralt Butonu */}
                            <TouchableOpacity
                              style={styles.btnDoneCard}
                              onPress={() => toggleExpand(index)}
                              activeOpacity={0.7}
                            >
                              <Ionicons name="checkmark-outline" size={15} color={MS.textPrimary} style={{ marginRight: 4 }} />
                              <Text style={styles.btnDoneCardText}>Tamamla & Kapat</Text>
                            </TouchableOpacity>
                          </Animated.View>
                        )}
                      </Animated.View>
                    );
                  })}
                </View>
              )}

              {/* Yeni Malzeme Ekle Butonu */}
              <TouchableOpacity
                style={styles.btnAddItem}
                onPress={addItem}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={MS.success} style={{ marginRight: 4 }} />
                <Text style={styles.btnAddItemText}>YENİ MALZEME EKLE</Text>
              </TouchableOpacity>
            </Animated.View>

            {/* C) TESLİMAT & HESAP ÖZETİ */}
            <Animated.View
              entering={FadeInDown.delay(140).duration(260).easing(Easing.out(Easing.cubic))}
              style={styles.sectionBlock}
            >
              <Text style={styles.sectionHeaderTitle}>HESAP ÖZETİ ({currency})</Text>

              <View style={[styles.inputField, { marginBottom: 12 }]}>
                <Text style={styles.fieldLabel}>Termin (Teslim Süresi)</Text>
                <TextInput
                  style={[styles.textInput, focusedInput === 'teslimSuresi' && styles.inputFocused]}
                  placeholder="Örn: STOK veya 2 Hafta"
                  placeholderTextColor={MS.textMuted}
                  value={teslimSuresi}
                  onChangeText={setTeslimSuresi}
                  onFocus={() => setFocusedInput('teslimSuresi')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View style={[styles.inputField, { marginBottom: 14 }]}>
                <Text style={styles.fieldLabel}>Ödeme Bilgisi</Text>
                <TextInput
                  style={[styles.textInput, focusedInput === 'odemeBilgisi' && styles.inputFocused]}
                  placeholder="Örn: NAKİT veya %50 PEŞİN"
                  placeholderTextColor={MS.textMuted}
                  value={odemeBilgisi}
                  onChangeText={setOdemeBilgisi}
                  onFocus={() => setFocusedInput('odemeBilgisi')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              {/* KDV ORANI SEÇİCİ */}
              <View style={[styles.inputField, { marginBottom: 14 }]}>
                <View style={styles.kdvHeaderRow}>
                  <Text style={styles.fieldLabel}>KDV Oranı</Text>
                  <Text style={styles.kdvSelectedBadge}>%{Math.round(kdvRate)}</Text>
                </View>
                <View style={styles.kdvSelectorRow}>
                  {[1, 10, 18, 20].map((rate) => {
                    const isSelected = Math.round(kdvRate) === rate;
                    return (
                      <TouchableOpacity
                        key={rate}
                        style={[
                          styles.kdvOptionBtn,
                          isSelected && styles.kdvOptionBtnActive
                        ]}
                        onPress={() => setKdvRate(rate)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.kdvOptionText,
                            isSelected && styles.kdvOptionTextActive
                          ]}
                        >
                          %{rate}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>ARA TOPLAM</Text>
                  <Text style={styles.summaryValue}>{formatUSD(subtotal)}</Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryTitle}>KDV (%{Math.round(kdvRate)})</Text>
                  <Text style={styles.summaryValue}>{formatUSD(kdv)}</Text>
                </View>
              </View>

              <View style={[styles.summaryCard, styles.summaryCardGrand]}>
                <Text style={styles.summaryGrandTitle}>GENEL TOPLAM ({currency})</Text>
                <Text style={styles.summaryGrandValue}>{formatUSD(grandTotal)}</Text>
              </View>
            </Animated.View>

            {/* D) ALT AKSİYON BUTONLARI */}
            <Animated.View
              entering={FadeInUp.delay(180).duration(280).easing(Easing.out(Easing.cubic))}
              style={styles.actionSection}
            >
              <Pressable
                style={{ flex: 1 }}
                onPress={handleOpenInAppPreview}
                onPressIn={handlePreviewPressIn}
                onPressOut={handlePreviewPressOut}
              >
                <Animated.View style={[styles.btnActionSecondary, previewAnimatedStyle]}>
                  <Ionicons name="eye-outline" size={16} color={MS.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={styles.btnActionSecondaryText}>ÖNİZLE & DÜZENLE</Text>
                </Animated.View>
              </Pressable>

              <View style={{ flex: 1 }}>
                <MorphingSuccessButton
                  ref={morphButtonRef}
                  title="PDF OLUŞTUR"
                  icon="document-text-outline"
                  onPress={handleSaveAndSharePDF}
                  disabled={isProcessing}
                  backgroundColor={MS.accent}
                  successColor="#107c41"
                  buttonHeight={48}
                />
              </View>
            </Animated.View>

            <View style={{ height: 140 }} />
          </Animated.ScrollView>

          {/* --- UYGULAMA İÇİ CANLI DÜZENLENEBİLİR PDF ÖNİZLEME MODALI --- */}
          <ProposalPreviewModal
            visible={previewVisible}
            onClose={() => setPreviewVisible(false)}
            proposalRecord={currentSavedRecord || (currentProposalId ? { id: currentProposalId, payload: getProposalPayload() } : { payload: getProposalPayload() })}
            onSaveUpdatedRecord={handleRecordUpdatedFromPreview}
          />

          {/* --- PRATİK TEKLİF HESAPLAYICI & KUR ÇEVİRİCİ MODALI --- */}
          <ProposalCalculatorModal
            visible={calcModalVisible}
            onClose={() => setCalcModalVisible(false)}
            rates={rates}
            currentGrandTotal={grandTotal}
            currentCurrency={currency}
          />

          {/* --- SEÇİM MODALI (MODEL & ASKI & GÖRSEL) --- */}
          <Modal
            visible={pickerModalVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setPickerModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFillObject}
                activeOpacity={1}
                onPress={() => setPickerModalVisible(false)}
              />
              <View style={[styles.modalContent, pickerType === 'motorImage' && { maxHeight: '82%' }]}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {pickerType === 'model'
                      ? 'Motor Modeli Seçin'
                      : pickerType === 'motorImage'
                        ? 'Motor Görseli Seçin'
                        : 'Askı Şekli Seçin'}
                  </Text>
                  <TouchableOpacity
                    style={styles.btnModalClose}
                    onPress={() => setPickerModalVisible(false)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close" size={20} color={MS.textPrimary} />
                  </TouchableOpacity>
                </View>

                {pickerType === 'motorImage' && (
                  <TouchableOpacity
                    style={styles.btnPickFromGallery}
                    onPress={pickImageFromGallery}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images" size={17} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnPickFromGalleryText}>Galeriden Fotoğraf Seç</Text>
                  </TouchableOpacity>
                )}

                <FlatList
                  key={pickerType === 'motorImage' ? 'grid-2' : 'list-1'}
                  numColumns={pickerType === 'motorImage' ? 2 : 1}
                  data={
                    pickerType === 'model'
                      ? MOTOR_LIST.map(m => m.model)
                      : pickerType === 'motorImage'
                        ? AVAILABLE_MOTOR_IMAGE_KEYS
                        : ['1:1', '2:1', '1:4', '1:6', '1:8']
                  }
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={pickerType === 'motorImage' ? { paddingBottom: 10 } : undefined}
                  renderItem={({ item }) => {
                    if (pickerType === 'motorImage') {
                      return (
                        <TouchableOpacity
                          style={styles.motorGridCard}
                          onPress={() => selectPickerValue(item)}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={MOTOR_IMAGES[item]}
                            style={styles.motorGridImage}
                            resizeMode="contain"
                          />
                          <Text style={styles.motorGridTitle} numberOfLines={1}>
                            FURDER {item}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        style={styles.modalItem}
                        onPress={() => selectPickerValue(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modalItemText}>{item}</Text>
                        <Ionicons name="chevron-forward" size={16} color={MS.textMuted} />
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>
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
  topHeaderRightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 8
  },
  ratesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: 32,
    gap: 6
  },
  rateItem: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  rateSymbol: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: '#a7f3d0',
    marginRight: 3
  },
  rateValue: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff'
  },
  rateSeparator: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#34a065',
    marginHorizontal: 1
  },
  btnCalcHeaderTop: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
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
    paddingHorizontal: 16,
    paddingBottom: 40,
    backgroundColor: '#fafafaff'
  },

  // Sade Bölüm Blokları
  sectionBlock: {
    marginBottom: 30
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4
  },
  sectionHeaderTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    color: MS.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 14,
    marginTop: 4
  },
  currencySection: {
    marginBottom: 16
  },
  currencySegmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    height: 44,
    overflow: 'hidden'
  },
  currencySegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderRightWidth: 1.5,
    borderRightColor: '#cbd5e1'
  },
  currencySegmentBtnLast: {
    borderRightWidth: 0
  },
  currencySegmentBtnActive: {
    backgroundColor: '#107c41'
  },
  currencySymbolBadge: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginRight: 4
  },
  currencySymbolBadgeActive: {
    color: '#ffffff'
  },
  currencySegmentText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: 0.3
  },
  currencySegmentTextActive: {
    color: '#ffffff'
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
  inputWithButton: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  btnInlineRefresh: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 0
  },

  // --- BÜTÜNLEŞİK MALZEME LİSTESİ STİLLERİ ---
  materialsListWrapper: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    marginBottom: 12,
    borderRadius: 0
  },
  listRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff'
  },
  listRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: MS.borderSubtle
  },
  listRowIndexBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f3f2f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  listRowIndexText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.textSecondary
  },
  listRowIndexBadgeActive: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#107c41',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  listRowIndexTextActive: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff'
  },
  listRowCenter: {
    flex: 1,
    marginRight: 8
  },
  listRowTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: MS.textPrimary,
    marginBottom: 2
  },
  listRowSubtitle: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '400',
    color: MS.textSecondary
  },
  listRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnRowDelete: {
    padding: 6,
    backgroundColor: '#ffffff'
  },
  materialsItemContainer: {
    backgroundColor: '#ffffff',
    overflow: 'hidden'
  },
  btnRowEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MS.accent,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  btnRowEditActive: {
    borderColor: MS.primary,
    backgroundColor: '#eef8f1'
  },
  btnRowEditText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: MS.accent
  },
  listExpandedInner: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 4,
    backgroundColor: '#ffffff'
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: MS.borderSubtle,
    paddingBottom: 8
  },
  expandedItemTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 14,
    fontWeight: '700',
    color: MS.textPrimary
  },
  btnDeleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MS.danger,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    borderRadius: 0
  },
  btnDeleteItemText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    fontWeight: '500',
    color: MS.danger
  },
  btnCollapse: {
    padding: 4,
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },

  // 2 SÜTUNLU GRID DÜZENİ
  gridContainer: {
    gap: 10
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10
  },
  gridField: {
    flex: 1
  },
  qtyContainer: {
    marginTop: 2
  },
  fieldInput: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '400',
    color: MS.textPrimary,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 0,
    height: 40
  },
  fieldInputHighlight: {
    borderColor: MS.accent,
    fontWeight: '500'
  },
  comboInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff'
  },
  comboTextInput: {
    flex: 1,
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '400',
    color: MS.textPrimary,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 0,
    height: 40
  },
  btnComboDropdown: {
    width: 38,
    height: 40,
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 0
  },
  selectorButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 8,
    height: 40,
    justifyContent: 'center',
    borderRadius: 0
  },
  selectorText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.textPrimary
  },
  selectorPlaceholder: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '400',
    color: MS.textMuted
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MS.borderLight,
    height: 40,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  btnStep: {
    width: 44,
    height: '100%',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center'
  },
  btnStepText: {
    fontSize: 18,
    fontWeight: '600',
    color: MS.textPrimary
  },
  stepperInput: {
    flex: 1,
    height: '100%',
    textAlign: 'center',
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '600',
    color: MS.textPrimary,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: MS.borderLight,
    backgroundColor: '#ffffff'
  },

  // Kartı Kapat / Tamamla Butonu
  btnDoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MS.borderLight,
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    marginTop: 12,
    borderRadius: 0
  },
  btnDoneCardText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.textPrimary
  },

  // Ortak Butonlar
  btnAddItem: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: MS.success,
    backgroundColor: '#ffffff',
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    borderRadius: 0
  },
  btnAddItemText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.success,
    letterSpacing: 0.5
  },
  btnClearAll: {
    borderWidth: 1,
    borderColor: MS.danger,
    backgroundColor: '#ffffff',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 0
  },
  btnClearAllText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    fontWeight: '600',
    color: MS.danger
  },
  emptyItemsState: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff'
  },
  emptyItemsTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: MS.textPrimary,
    marginBottom: 4
  },
  emptyItemsDesc: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '400',
    color: MS.textSecondary,
    textAlign: 'center',
    maxWidth: 260
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: MS.borderLight,
    padding: 11,
    backgroundColor: '#ffffff',
    borderRadius: 0
  },
  summaryTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    fontWeight: '500',
    color: MS.textSecondary,
    marginBottom: 4
  },
  summaryValue: {
    fontFamily: MS.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: MS.textPrimary
  },
  summaryCardGrand: {
    borderColor: MS.success,
    borderWidth: 1.5,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 15
  },
  summaryGrandTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: MS.success,
    letterSpacing: 0.3
  },
  summaryGrandValue: {
    fontFamily: MS.fontFamily,
    fontSize: 17,
    fontWeight: '600',
    color: MS.success
  },
  actionSection: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  btnActionSecondary: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: MS.border,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0
  },
  btnActionSecondaryText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: MS.textPrimary,
    letterSpacing: 0.3
  },
  btnActionPrimary: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: MS.accent,
    backgroundColor: MS.accent,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0
  },
  btnActionPrimaryText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.3
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

  // Seçim Modalı
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    width: '100%',
    maxHeight: '70%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: MS.border,
    padding: 16,
    borderRadius: 0
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: MS.borderLight,
    paddingBottom: 10,
    marginBottom: 10
  },
  modalTitle: {
    fontFamily: MS.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    color: MS.textPrimary
  },
  btnModalClose: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: MS.borderSubtle
  },
  modalItemText: {
    fontFamily: MS.fontFamily,
    fontSize: 13,
    fontWeight: '500',
    color: MS.textPrimary
  },
  motorImageCardSection: {
    marginTop: 12,
    marginBottom: 4
  },
  selectedMotorImageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    padding: 10,
    borderRadius: 0
  },
  motorImageThumbnail: {
    width: 60,
    height: 60,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    marginRight: 12
  },
  motorImageInfoCol: {
    flex: 1,
    justifyContent: 'center'
  },
  motorImageKeyText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: MS.textPrimary,
    marginBottom: 10
  },
  motorImageSubText: {
    fontFamily: MS.fontFamily,
    fontSize: 11,
    color: '#107c41',
    marginBottom: 6
  },
  motorImageActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  btnChangeImage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#107c41',
    borderRadius: 0
  },
  btnChangeImageText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11,
    color: '#107c41'
  },
  btnRemoveImage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.danger,
    borderRadius: 0
  },
  btnRemoveImageText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 11,
    color: MS.danger
  },
  btnAddMotorImage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#107c41',
    borderStyle: 'dashed',
    borderRadius: 0
  },
  btnAddMotorImageText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#107c41'
  },
  btnPickFromGallery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#107c41',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 0,
    marginBottom: 10
  },
  btnPickFromGalleryText: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 0.3
  },
  motorGridCard: {
    flex: 1,
    margin: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: MS.borderLight,
    borderRadius: 0,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  motorGridImage: {
    width: '100%',
    height: 84,
    marginBottom: 6
  },
  motorGridTitle: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: MS.textPrimary,
    textAlign: 'center'
  },
  kdvHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  kdvSelectedBadge: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 12,
    color: '#107c41',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 0
  },
  kdvSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  kdvOptionBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d2d0ce',
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center'
  },
  kdvOptionBtnActive: {
    backgroundColor: '#107c41',
    borderColor: '#107c41'
  },
  kdvOptionText: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 13,
    color: '#334155'
  },
  kdvOptionTextActive: {
    fontFamily: MS.fontFamilyBold,
    color: '#ffffff'
  }
});
