import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MS } from '../constants/theme';
import { DEFAULT_RATES } from '../utils/currencyService';

export default function ProposalCalculatorModal({
  visible,
  onClose,
  rates = { usd: null, eur: null },
  currentGrandTotal = 0,
  currentCurrency = 'USD'
}) {
  // İlk açılışta doğrudan Hesap Makinesi aktif
  const [activeTab, setActiveTab] = useState('calc'); // 'calc' | 'currency' | 'kdv'

  // --- HESAP MAKİNESİ STATE ---
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [prevValue, setPrevValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  // Kurlar (Canlı kur yoksa güncel gerçek piyasa değerlerini kullan)
  const usdRateNum = rates?.usd ? parseFloat(rates.usd) : parseFloat(DEFAULT_RATES.usd);
  const eurRateNum = rates?.eur ? parseFloat(rates.eur) : parseFloat(DEFAULT_RATES.eur);

  // Sayı formatla (ekran için)
  const formatDisplayNum = (numStr) => {
    if (!numStr || numStr === 'Hata') return numStr || '0';
    const parts = numStr.split('.');
    const integerPart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
    const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return formattedInt + (decimalPart ? ',' + parts[1] : '');
  };

  const fmt = (num, curr = '') => {
    const val = typeof num === 'number' ? num : parseFloat(num) || 0;
    const formatted = val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return curr ? `${formatted} ${curr}` : formatted;
  };

  const parseVal = (str) => {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^0-9.,-]/g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const inputDigit = (digit) => {
    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
    } else {
      if (display === '0') {
        setDisplay(String(digit));
      } else if (display.length < 12) {
        setDisplay(display + digit);
      }
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearCalc = () => {
    setDisplay('0');
    setEquation('');
    setPrevValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const backspaceCalc = () => {
    if (waitingForOperand) return;
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const performOperation = (nextOperator) => {
    const inputValue = parseFloat(display);

    if (prevValue == null) {
      setPrevValue(inputValue);
      setEquation(`${inputValue} ${nextOperator}`);
    } else if (operator) {
      const currentValue = prevValue || 0;
      let newValue = currentValue;

      if (operator === '+') newValue = currentValue + inputValue;
      else if (operator === '−') newValue = currentValue - inputValue;
      else if (operator === '×') newValue = currentValue * inputValue;
      else if (operator === '÷') newValue = inputValue !== 0 ? currentValue / inputValue : 0;

      const rounded = parseFloat(newValue.toFixed(4));
      setPrevValue(rounded);
      setDisplay(String(rounded));
      setEquation(nextOperator === '=' ? '' : `${rounded} ${nextOperator}`);
    }

    setWaitingForOperand(true);
    setOperator(nextOperator === '=' ? null : nextOperator);
  };

  // % (Yüzde) İşlemi
  const handlePercentage = () => {
    const currentVal = parseFloat(display) || 0;
    if (prevValue != null && operator) {
      let percentVal = (prevValue * currentVal) / 100;
      if (operator === '×' || operator === '÷') {
        percentVal = currentVal / 100;
      }
      setDisplay(String(parseFloat(percentVal.toFixed(4))));
    } else {
      const res = currentVal / 100;
      setDisplay(String(parseFloat(res.toFixed(4))));
    }
  };

  // --- HIZLI PRATİK TEKLİF BUTONLARI ---
  // + %20 KDV Ekle
  const quickAddKDV = () => {
    const val = parseFloat(display) || 0;
    const withKdv = parseFloat((val * 1.20).toFixed(2));
    setEquation(`${val} + %20 KDV`);
    setDisplay(String(withKdv));
    setWaitingForOperand(true);
  };

  // − %20 KDV Çıkar (Net Matrah)
  const quickRemoveKDV = () => {
    const val = parseFloat(display) || 0;
    const net = parseFloat((val / 1.20).toFixed(2));
    setEquation(`${val} − %20 KDV (Net)`);
    setDisplay(String(net));
    setWaitingForOperand(true);
  };

  // Teklif Genel Toplamını Ekrana Yükle
  const loadProposalTotal = () => {
    if (currentGrandTotal && currentGrandTotal > 0) {
      setDisplay(String(currentGrandTotal));
      setEquation(`Teklif Toplamı (${currentCurrency})`);
      setWaitingForOperand(true);
    } else {
      Alert.alert('Bilgi', 'Mevcut teklifte henüz hesaplanmış bir tutar bulunmuyor.');
    }
  };

  // --- DÖVİZ ÇEVİRİCİ STATE (Varsayılan 1) ---
  const [convAmount, setConvAmount] = useState('1');
  const [convCurrency, setConvCurrency] = useState(currentCurrency || 'USD');

  const baseConvNum = parseVal(convAmount);

  // --- KDV HESAPLAYICI STATE (İki Yönlü & Oran Seçimli) ---
  const [kdvRate, setKdvRate] = useState('20');
  const [basePriceInput, setBasePriceInput] = useState('1000');
  const [totalPriceInput, setTotalPriceInput] = useState('1200');

  // Ham fiyattan toplamı güncelle
  const handleBasePriceChange = (text) => {
    setBasePriceInput(text);
    const val = parseVal(text);
    const rate = parseVal(kdvRate) || 0;
    if (val > 0) {
      const total = val * (1 + rate / 100);
      setTotalPriceInput(total.toFixed(2).replace(/\.00$/, ''));
    } else {
      setTotalPriceInput('');
    }
  };

  // Toplam fiyattan ham fiyatı hesapla (Örn: Toplam 1000 olsun -> Ham 833.33)
  const handleTotalPriceChange = (text) => {
    setTotalPriceInput(text);
    const val = parseVal(text);
    const rate = parseVal(kdvRate) || 0;
    if (val > 0) {
      const base = val / (1 + rate / 100);
      setBasePriceInput(base.toFixed(2).replace(/\.00$/, ''));
    } else {
      setBasePriceInput('');
    }
  };

  // KDV Oranı değişince güncelle
  const handleKdvRateChange = (newRateStr) => {
    setKdvRate(newRateStr);
    const rate = parseVal(newRateStr) || 0;
    const base = parseVal(basePriceInput);
    if (base > 0) {
      const total = base * (1 + rate / 100);
      setTotalPriceInput(total.toFixed(2).replace(/\.00$/, ''));
    }
  };

  const calculatedBase = parseVal(basePriceInput);
  const calculatedTotal = parseVal(totalPriceInput);
  const calculatedKdvAmount = Math.max(0, calculatedTotal - calculatedBase);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.fullScreenContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#107c41" translucent={false} />

        {/* 1. ÜST YEŞİL KURUMSAL BAŞLIK BARI */}
        <View style={styles.topGreenHeader}>
          <View style={styles.modalHeaderRow}>
            <TouchableOpacity
              style={styles.btnClose}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={17} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.btnCloseText}>Geri</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>HESAP MAKİNESİ</Text>

            <View style={styles.headerRightRates}>
              <Text style={styles.headerRatesText}>$ {usdRateNum}</Text>
              <Text style={styles.headerRateSep}>|</Text>
              <Text style={styles.headerRatesText}>€ {eurRateNum}</Text>
            </View>
          </View>
        </View>

        {/* 2. KÖŞELİ TAB MENÜSÜ */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'calc' && styles.tabButtonActive]}
            onPress={() => setActiveTab('calc')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="keypad-outline"
              size={15}
              color={activeTab === 'calc' ? '#ffffff' : MS.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'calc' && styles.tabButtonTextActive]}>
              Hesap Makinesi
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'currency' && styles.tabButtonActive]}
            onPress={() => setActiveTab('currency')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="swap-horizontal"
              size={15}
              color={activeTab === 'currency' ? '#ffffff' : MS.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'currency' && styles.tabButtonTextActive]}>
              Döviz Çevirici
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, styles.tabButtonLast, activeTab === 'kdv' && styles.tabButtonActive]}
            onPress={() => setActiveTab('kdv')}
            activeOpacity={0.75}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={activeTab === 'kdv' ? '#ffffff' : MS.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.tabButtonText, activeTab === 'kdv' && styles.tabButtonTextActive]}>
              KDV Hesaplama
            </Text>
          </TouchableOpacity>
        </View>

        {/* 3. İÇERİK FORMU */}
        {/* --- TAB 1: BÜYÜK HESAP MAKİNESİ --- */}
        {activeTab === 'calc' && (
          <View style={styles.calcMainContainer}>
            {/* BÜYÜK HESAP MAKİNESİ EKRANI */}
            <View style={styles.calcDisplayBox}>
              <Text style={styles.calcEquationText}>{equation}</Text>
              <Text
                style={styles.calcMainDisplayText}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.5}
              >
                {formatDisplayNum(display)}
              </Text>
            </View>

            {/* HIZLI PRATİK TEKLİF BUTONLARI */}
            <View style={styles.quickShortcutsRow}>
              <TouchableOpacity
                style={styles.btnQuickShortcut}
                onPress={quickAddKDV}
                activeOpacity={0.7}
              >
                <Text style={styles.btnQuickShortcutText}>+ %20 KDV</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnQuickShortcut}
                onPress={quickRemoveKDV}
                activeOpacity={0.7}
              >
                <Text style={styles.btnQuickShortcutText}>− %20 KDV</Text>
              </TouchableOpacity>

              {currentGrandTotal > 0 && (
                <TouchableOpacity
                  style={[styles.btnQuickShortcut, styles.btnQuickShortcutHighlight]}
                  onPress={loadProposalTotal}
                  activeOpacity={0.7}
                >
                  <Ionicons name="download-outline" size={13} color="#107c41" style={{ marginRight: 3 }} />
                  <Text style={[styles.btnQuickShortcutText, styles.btnQuickShortcutHighlightText]}>
                    Teklif Tutarı ({fmt(currentGrandTotal, currentCurrency)})
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* BÜYÜK VE RAHAT KÖŞELİ TUŞ TAKIMI */}
            <View style={styles.bigKeypad}>
              {/* Satır 1 */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnClear]} onPress={clearCalc}>
                  <Text style={styles.keyBtnTextClear}>C</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnSpecial]} onPress={backspaceCalc}>
                  <Ionicons name="backspace-outline" size={25} color="#334155" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnSpecial]} onPress={handlePercentage}>
                  <Text style={styles.keyBtnTextSpecial}>%</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnOp]} onPress={() => performOperation('÷')}>
                  <Text style={styles.keyBtnTextOp}>÷</Text>
                </TouchableOpacity>
              </View>

              {/* Satır 2 */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(7)}>
                  <Text style={styles.keyBtnText}>7</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(8)}>
                  <Text style={styles.keyBtnText}>8</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(9)}>
                  <Text style={styles.keyBtnText}>9</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnOp]} onPress={() => performOperation('×')}>
                  <Text style={styles.keyBtnTextOp}>×</Text>
                </TouchableOpacity>
              </View>

              {/* Satır 3 */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(4)}>
                  <Text style={styles.keyBtnText}>4</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(5)}>
                  <Text style={styles.keyBtnText}>5</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(6)}>
                  <Text style={styles.keyBtnText}>6</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnOp]} onPress={() => performOperation('−')}>
                  <Text style={styles.keyBtnTextOp}>−</Text>
                </TouchableOpacity>
              </View>

              {/* Satır 4 */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(1)}>
                  <Text style={styles.keyBtnText}>1</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(2)}>
                  <Text style={styles.keyBtnText}>2</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={() => inputDigit(3)}>
                  <Text style={styles.keyBtnText}>3</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnOp]} onPress={() => performOperation('+')}>
                  <Text style={styles.keyBtnTextOp}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Satır 5 */}
              <View style={styles.keypadRow}>
                <TouchableOpacity style={[styles.keyBtn, { flex: 2 }]} onPress={() => inputDigit(0)}>
                  <Text style={styles.keyBtnText}>0</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.keyBtn} onPress={inputDecimal}>
                  <Text style={styles.keyBtnText}>,</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.keyBtn, styles.keyBtnEqual]} onPress={() => performOperation('=')}>
                  <Text style={styles.keyBtnTextEqual}>=</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* --- TAB 2: ANLAŞILIR DÖVİZ ÇEVİRİCİ --- */}
        {activeTab === 'currency' && (
          <ScrollView
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeIn.duration(200)}>
              {/* Üst Tutar Girişi */}
              <View style={styles.simpleCard}>
                <Text style={styles.cardHeaderTitle}>ÇEVRİLECEK TUTAR</Text>
                <View style={styles.inputWithCurrencyRow}>
                  <TextInput
                    style={styles.simpleLargeInput}
                    keyboardType="numeric"
                    value={convAmount}
                    onChangeText={setConvAmount}
                    placeholder="1"
                  />
                  <View style={styles.currencyTogglePills}>
                    {['USD', 'TL', 'EUR'].map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.currPill, convCurrency === c && styles.currPillActive]}
                        onPress={() => setConvCurrency(c)}
                      >
                        <Text style={[styles.currPillText, convCurrency === c && styles.currPillTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.sectionHeading}>DÖVİZ KARŞILIKLARI</Text>
              <View style={styles.conversionResultsStack}>
                {/* 1. USD seçiliyse: Sadece TL ve EUR göster */}
                {convCurrency === 'USD' && (
                  <>
                    <View style={styles.convResultBox}>
                      <View style={styles.convResultHeaderRow}>
                        <Text style={styles.convResultLabel}>TÜRK LİRASI (TL)</Text>
                        <Text style={styles.convResultFormula}>{baseConvNum} USD × {usdRateNum} ₺</Text>
                      </View>
                      <Text style={[styles.convResultAmount, { color: '#107c41' }]}>
                        {fmt(baseConvNum * usdRateNum, '₺')}
                      </Text>
                    </View>

                    <View style={styles.convResultBox}>
                      <View style={styles.convResultHeaderRow}>
                        <Text style={styles.convResultLabel}>EURO (EUR)</Text>
                        <Text style={styles.convResultFormula}>{baseConvNum} USD ÷ {(eurRateNum / usdRateNum).toFixed(3)}</Text>
                      </View>
                      <Text style={styles.convResultAmount}>
                        {fmt(eurRateNum > 0 ? (baseConvNum * usdRateNum) / eurRateNum : 0, '€')}
                      </Text>
                    </View>
                  </>
                )}

                {/* 2. TL seçiliyse: Sadece USD ve EUR göster */}
                {convCurrency === 'TL' && (
                  <>
                    <View style={styles.convResultBox}>
                      <View style={styles.convResultHeaderRow}>
                        <Text style={styles.convResultLabel}>DOLAR (USD)</Text>
                        <Text style={styles.convResultFormula}>{baseConvNum} TL ÷ {usdRateNum} ₺</Text>
                      </View>
                      <Text style={[styles.convResultAmount, { color: '#0284c7' }]}>
                        {fmt(usdRateNum > 0 ? baseConvNum / usdRateNum : 0, '$')}
                      </Text>
                    </View>

                    <View style={styles.convResultBox}>
                      <View style={styles.convResultHeaderRow}>
                        <Text style={styles.convResultLabel}>EURO (EUR)</Text>
                        <Text style={styles.convResultFormula}>{baseConvNum} TL ÷ {eurRateNum} ₺</Text>
                      </View>
                      <Text style={styles.convResultAmount}>
                        {fmt(eurRateNum > 0 ? baseConvNum / eurRateNum : 0, '€')}
                      </Text>
                    </View>
                  </>
                )}

                {/* 3. EUR seçiliyse: Sadece TL ve USD göster */}
                {convCurrency === 'EUR' && (
                  <>
                    <View style={styles.convResultBox}>
                      <View style={styles.convResultHeaderRow}>
                        <Text style={styles.convResultLabel}>TÜRK LİRASI (TL)</Text>
                        <Text style={styles.convResultFormula}>{baseConvNum} EUR × {eurRateNum} ₺</Text>
                      </View>
                      <Text style={[styles.convResultAmount, { color: '#107c41' }]}>
                        {fmt(baseConvNum * eurRateNum, '₺')}
                      </Text>
                    </View>

                    <View style={styles.convResultBox}>
                      <View style={styles.convResultHeaderRow}>
                        <Text style={styles.convResultLabel}>DOLAR (USD)</Text>
                        <Text style={styles.convResultFormula}>{baseConvNum} EUR × {(eurRateNum / usdRateNum).toFixed(3)}</Text>
                      </View>
                      <Text style={[styles.convResultAmount, { color: '#0284c7' }]}>
                        {fmt(usdRateNum > 0 ? (baseConvNum * eurRateNum) / usdRateNum : 0, '$')}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </Animated.View>
          </ScrollView>
        )}

        {/* --- TAB 3: KDV HESAPLAYICI (İKİ YÖNLÜ & ORAN SEÇİMLİ) --- */}
        {activeTab === 'kdv' && (
          <ScrollView
            style={{ flex: 1, backgroundColor: '#ffffff' }}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeIn.duration(200)}>
              {/* KDV ORANI SEÇİMİ */}
              <View style={styles.simpleCard}>
                <Text style={styles.cardHeaderTitle}>KDV ORANI SEÇİN</Text>
                <View style={styles.kdvRatePresetRow}>
                  {['20', '10', '1', '0'].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[styles.kdvRateBtn, kdvRate === rate && styles.kdvRateBtnActive]}
                      onPress={() => handleKdvRateChange(rate)}
                    >
                      <Text style={[styles.kdvRateBtnText, kdvRate === rate && styles.kdvRateBtnTextActive]}>
                        %{rate}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.customRateWrapper}>
                    <TextInput
                      style={styles.customRateInput}
                      keyboardType="numeric"
                      value={kdvRate}
                      onChangeText={handleKdvRateChange}
                      placeholder="%"
                    />
                    <Text style={{ fontWeight: '700', color: '#64748b', marginLeft: 2 }}>%</Text>
                  </View>
                </View>
              </View>

              {/* İKİ YÖNLÜ FİYAT GİRİŞ KUTULARI */}
              <Text style={styles.sectionHeading}>İKİ YÖNLÜ FİYAT HESAPLAMA</Text>
              <View style={styles.twoWayCard}>
                {/* 1. Ham Fiyat (KDV Hariç) */}
                <View style={styles.twoWayFieldGroup}>
                  <Text style={styles.twoWayFieldLabel}>1. HAM FİYAT (KDV HARİÇ)</Text>
                  <TextInput
                    style={styles.twoWayInput}
                    keyboardType="numeric"
                    value={basePriceInput}
                    onChangeText={handleBasePriceChange}
                    placeholder="0,00"
                  />
                  <Text style={styles.twoWayHelper}>Ham fiyatı girerseniz toplam otomatik hesaplanır.</Text>
                </View>

                {/* İki kutu arası ayraç / ok simgesi */}
                <View style={styles.twoWayDividerRow}>
                  <View style={styles.twoWayDividerLine} />
                  <View style={styles.twoWayDividerBadge}>
                    <Ionicons name="swap-vertical" size={16} color="#107c41" />
                    <Text style={styles.twoWayDividerBadgeText}>%{kdvRate} KDV</Text>
                  </View>
                  <View style={styles.twoWayDividerLine} />
                </View>

                {/* 2. Toplam Fiyat (KDV Dahil - Hedef Tutar) */}
                <View style={styles.twoWayFieldGroup}>
                  <Text style={[styles.twoWayFieldLabel, { color: '#107c41' }]}>
                    2. TOPLAM FİYAT (KDV DAHİL)
                  </Text>
                  <TextInput
                    style={[styles.twoWayInput, styles.twoWayInputHighlight]}
                    keyboardType="numeric"
                    value={totalPriceInput}
                    onChangeText={handleTotalPriceChange}
                    placeholder="0,00"
                  />
                  <Text style={styles.twoWayHelper}>
                    Hedef toplamı (örn: 1000) yazarsanız ham fiyat ve KDV anında hesaplanır.
                  </Text>
                </View>
              </View>

              {/* Özet Döküm Tablosu */}
              <View style={styles.kdvSummaryResultBox}>
                <View style={styles.kdvSummaryResultRow}>
                  <Text style={styles.kdvSummaryLbl}>Ham Fiyat (Matrah):</Text>
                  <Text style={styles.kdvSummaryVal}>{fmt(calculatedBase)}</Text>
                </View>
                <View style={styles.kdvSummaryResultRow}>
                  <Text style={styles.kdvSummaryLbl}>KDV Tutarı (%{kdvRate}):</Text>
                  <Text style={[styles.kdvSummaryVal, { color: '#0284c7' }]}>+ {fmt(calculatedKdvAmount)}</Text>
                </View>
                <View style={[styles.kdvSummaryResultRow, { borderTopWidth: 1, borderTopColor: '#d2d0ce', paddingTop: 8, marginTop: 4 }]}>
                  <Text style={[styles.kdvSummaryLbl, { fontWeight: '700', color: '#0f172a' }]}>
                    KDV Dahil Toplam:
                  </Text>
                  <Text style={[styles.kdvSummaryVal, { fontWeight: '800', color: '#107c41', fontSize: 18 }]}>
                    {fmt(calculatedTotal)}
                  </Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#ffffff'
  },

  // Üst Başlık Barı (Yukarı Alındı & Kutusuz Beyaz Kurlar)
  topGreenHeader: {
    backgroundColor: '#107c41',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 14 : 16,
    paddingBottom: 14,
    paddingHorizontal: 16
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  btnClose: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 0,
    backgroundColor: 'transparent'
  },
  btnCloseText: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff'
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.3
  },
  headerRightRates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  headerRatesText: {
    fontSize: 13,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#ffffff'
  },
  headerRateSep: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.45)',
    marginHorizontal: 1
  },

  // Tab Menu (Köşeli)
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#d2d0ce'
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRightWidth: 1,
    borderRightColor: '#d2d0ce',
    borderRadius: 0,
    backgroundColor: '#f8fafc'
  },
  tabButtonLast: {
    borderRightWidth: 0
  },
  tabButtonActive: {
    backgroundColor: '#107c41'
  },
  tabButtonText: {
    fontSize: 12,
    fontFamily: MS.fontFamily,
    fontWeight: '600',
    color: '#475569'
  },
  tabButtonTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },

  // --- HESAP MAKİNESİ DÜZENİ ---
  calcMainContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 12,
    justifyContent: 'flex-start'
  },
  calcDisplayBox: {
    backgroundColor: '#0f172a',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minHeight: 104
  },
  calcEquationText: {
    fontSize: 14,
    fontFamily: MS.fontFamily,
    color: '#94a3b8',
    minHeight: 20
  },
  calcMainDisplayText: {
    fontSize: 40,
    fontFamily: MS.fontFamily,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4
  },

  // Hızlı Kısayol Butonları
  quickShortcutsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10
  },
  btnQuickShortcut: {
    flex: 1,
    flexDirection: 'row',
    height: 42,
    backgroundColor: '#f1f5f9',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center'
  },
  btnQuickShortcutText: {
    fontSize: 12.5,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#1e293b'
  },
  btnQuickShortcutHighlight: {
    backgroundColor: '#e6f4ea',
    borderColor: '#107c41'
  },
  btnQuickShortcutHighlightText: {
    color: '#107c41'
  },

  // Tuş Takımı (Geniş & Rahat Butonlar)
  bigKeypad: {
    gap: 8,
    marginTop: 4
  },
  keypadRow: {
    height: 72,
    flexDirection: 'row',
    gap: 8
  },
  keyBtn: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1'
  },
  keyBtnText: {
    fontSize: 26,
    fontFamily: MS.fontFamily,
    fontWeight: '600',
    color: '#0f172a'
  },
  keyBtnClear: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5'
  },
  keyBtnTextClear: {
    fontSize: 24,
    fontFamily: MS.fontFamily,
    fontWeight: '800',
    color: '#dc2626'
  },
  keyBtnSpecial: {
    backgroundColor: '#f1f5f9'
  },
  keyBtnTextSpecial: {
    fontSize: 22,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#334155'
  },
  keyBtnOp: {
    backgroundColor: '#e0f2fe',
    borderColor: '#93c5fd'
  },
  keyBtnTextOp: {
    fontSize: 28,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#0284c7'
  },
  keyBtnEqual: {
    backgroundColor: '#107c41',
    borderColor: '#107c41'
  },
  keyBtnTextEqual: {
    fontSize: 29,
    fontFamily: MS.fontFamily,
    fontWeight: '800',
    color: '#ffffff'
  },

  // --- DÖVİZ & KDV STİLLERİ ---
  simpleCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    padding: 14,
    marginBottom: 16
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  inputWithCurrencyRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  simpleLargeInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    paddingHorizontal: 12,
    fontSize: 20,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#0f172a'
  },
  currencyTogglePills: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#d2d0ce',
    borderRadius: 0,
    backgroundColor: '#ffffff'
  },
  currPill: {
    paddingHorizontal: 11,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#d2d0ce'
  },
  currPillActive: {
    backgroundColor: '#107c41',
    borderRightColor: '#107c41'
  },
  currPillText: {
    fontSize: 12,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#475569'
  },
  currPillTextActive: {
    color: '#ffffff'
  },
  sectionHeading: {
    fontSize: 11,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 8
  },
  conversionResultsStack: {
    gap: 12
  },
  convResultBox: {
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    padding: 14
  },
  convResultHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  convResultLabel: {
    fontSize: 12,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#64748b'
  },
  convResultFormula: {
    fontSize: 11,
    fontFamily: MS.fontFamily,
    color: '#94a3b8'
  },
  convResultAmount: {
    fontSize: 24,
    fontFamily: MS.fontFamily,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2
  },

  // KDV Oran Presetleri
  kdvRatePresetRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center'
  },
  kdvRateBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    justifyContent: 'center',
    alignItems: 'center'
  },
  kdvRateBtnActive: {
    backgroundColor: '#107c41',
    borderColor: '#107c41'
  },
  kdvRateBtnText: {
    fontSize: 13,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#334155'
  },
  kdvRateBtnTextActive: {
    color: '#ffffff'
  },
  customRateWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d2d0ce',
    paddingHorizontal: 6,
    height: 38,
    backgroundColor: '#ffffff'
  },
  customRateInput: {
    width: 32,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    paddingVertical: 0
  },

  // İki Yönlü KDV Kartı
  twoWayCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    padding: 14,
    marginBottom: 14
  },
  twoWayFieldGroup: {
    marginBottom: 6
  },
  twoWayFieldLabel: {
    fontSize: 11,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6
  },
  twoWayInput: {
    height: 44,
    backgroundColor: '#ffffff',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    paddingHorizontal: 12,
    fontSize: 18,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#0f172a'
  },
  twoWayInputHighlight: {
    borderColor: '#107c41',
    backgroundColor: '#f0fdf4'
  },
  twoWayHelper: {
    fontSize: 10.5,
    fontFamily: MS.fontFamily,
    color: '#94a3b8',
    marginTop: 4
  },
  twoWayDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10
  },
  twoWayDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#d2d0ce'
  },
  twoWayDividerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#107c41',
    marginHorizontal: 8,
    gap: 4
  },
  twoWayDividerBadgeText: {
    fontSize: 11,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#107c41'
  },

  // Özet Sonuç Kutusu
  kdvSummaryResultBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#d2d0ce',
    padding: 14,
    gap: 6
  },
  kdvSummaryResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  kdvSummaryLbl: {
    fontSize: 12.5,
    fontFamily: MS.fontFamily,
    color: '#64748b'
  },
  kdvSummaryVal: {
    fontSize: 14,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#0f172a'
  }
});
