import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  Platform,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import Animated, { FadeIn, FadeOut, FadeInDown, FadeOutUp, Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MS, STORAGE_KEY, LAST_TEKLIF_NO_KEY } from '../constants/theme';
import { generateProposalHTML, exportAndSharePDF } from '../utils/pdfGenerator';

export default function ProposalPreviewModal({
  visible,
  onClose,
  proposalRecord,
  onSaveUpdatedRecord,
  initialEditMode = false
}) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [currentHTML, setCurrentHTML] = useState('');
  const [initialHTML, setInitialHTML] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [currencyDropdownVisible, setCurrencyDropdownVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const webViewRef = useRef(null);

  // Modal açıldığında güncel şablon kurallarıyla HTML oluştur veya kayıtlı HTML'i yükle
  useEffect(() => {
    if (visible && proposalRecord) {
      const payload = proposalRecord.payload || proposalRecord;
      const initialCurr = payload.currency || proposalRecord.currency || 'USD';
      setCurrency(initialCurr);
      setCurrencyDropdownVisible(false);

      // Daha önce kaydedilmiş HTML varsa onu yükle, yoksa şablondan üret
      let htmlToUse = proposalRecord.savedHTML || payload.savedHTML;
      if (!htmlToUse) {
        htmlToUse = generateProposalHTML(payload, { isEditable: false });
      } else {
        // Eski kayıtlarda kalmış olabilecek yeşil kutu arka planlarını, başlık düzenleme sınıfını ve ızgara çizgisi kurallarını normalize et
        htmlToUse = htmlToUse
          .replace(/rgba\(16,\s*124,\s*65,\s*0\.08\)/gi, '#ffffff')
          .replace(/rgba\(16,\s*124,\s*65,\s*0\.18\)/gi, 'transparent')
          .replace(/#f0fdf4/gi, '#ffffff')
          .replace(/#e8f5e9/gi, '#ffffff')
          .replace(/class="top-header-text\s+editable-field"/gi, 'class="top-header-text"')
          .replace(
            /\.editable-cell,\s*\.editable-field\s*\{\s*outline:\s*none\s*!important;\s*border:\s*none\s*!important;[^}]*\}/gi,
            'span.editable-field, div.editable-field { outline: none !important; border: none !important; background: transparent !important; box-shadow: none !important; } .editable-cell { outline: none !important; box-shadow: none !important; } .mat-table th, .mat-table td { border: 1.2px solid #000000 !important; } .info-table th, .info-table td { border: 1.2px solid #000000 !important; }'
          );
      }
      setInitialHTML(htmlToUse);
      setCurrentHTML(htmlToUse);
      setIsEditing(Boolean(initialEditMode));
    }
  }, [visible, proposalRecord, initialEditMode]);

  const forceEditableStylesJS = `
    (function() {
      var styleId = 'force-editable-thick-green-borders';
      var existingStyle = document.getElementById(styleId);
      if (!existingStyle) {
        var style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = 'body.editing-active span.editable-field { background-color: #ffffff !important; background: #ffffff !important; border: 2.2px solid #107c41 !important; border-radius: 4px !important; box-shadow: 0 0 0 1px rgba(16, 124, 65, 0.18) !important; color: #000000 !important; } body.editing-active div.editable-field:not(.top-header-text) { background-color: #ffffff !important; background: #ffffff !important; border: 2.2px solid #107c41 !important; border-radius: 5px !important; box-shadow: 0 0 0 1px rgba(16, 124, 65, 0.18) !important; color: #000000 !important; } body.editing-active .editable-cell { background-color: #ffffff !important; background: #ffffff !important; outline: 2.2px solid #107c41 !important; outline-offset: -2px !important; border-radius: 3px !important; } body.editing-active span.editable-field:focus, body.editing-active div.editable-field:focus { outline: 2.8px solid #107c41 !important; border-color: #107c41 !important; box-shadow: 0 0 0 4px rgba(16, 124, 65, 0.3) !important; } body.editing-active .editable-cell:focus { outline: 2.8px solid #107c41 !important; box-shadow: inset 0 0 0 2.5px rgba(16, 124, 65, 0.3) !important; } body.editing-active .top-header-text { border: none !important; outline: none !important; box-shadow: none !important; background: transparent !important; }';
        document.head.appendChild(style);
      }
    })();
  `;

  // Düzenleme modunu aç veya "Tamam" ile kaydet
  const handleToggleOrSave = () => {
    setCurrencyDropdownVisible(false);
    if (isEditing) {
      // "Tamam" tıklandı: WebView'a kaydetme komutu gönder
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.saveAndExtractData) {
            window.saveAndExtractData();
          } else if (window.setEditingMode) {
            window.setEditingMode(false);
          }
          true;
        `);
      }
      setIsEditing(false);
    } else {
      // "Düzenle" tıklandı: Düzenleme modunu aç
      setIsEditing(true);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          ${forceEditableStylesJS}
          if (window.setEditingMode) {
            window.setEditingMode(true);
          }
          true;
        `);
      }
    }
  };

  // Canlı Para Birimi Değiştir
  const handleChangeCurrency = (newCurr) => {
    setCurrency(newCurr);
    setCurrencyDropdownVisible(false);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        if (window.setCurrencyCode) {
          window.setCurrencyCode("${newCurr}");
        }
        true;
      `);
    }
  };

  // WebView'dan gelen canlı hesaplama ve kaydetme mesajlarını al
  const handleWebViewMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'SAVE_AND_EXIT') {
        const cleanHTML = data.cleanHTML || data.rawHTML;
        if (cleanHTML) {
          setCurrentHTML(cleanHTML);
          setInitialHTML(cleanHTML);
        }

        if (proposalRecord) {
          const existingPayload = proposalRecord.payload || proposalRecord;
          const updatedCurrency = data.extracted?.currency || currency || existingPayload.currency || 'USD';
          const extractedItems = (data.extracted?.items && data.extracted.items.length > 0)
            ? data.extracted.items
            : existingPayload.items;

          const updated = {
            ...proposalRecord,
            firma: data.extracted?.clientFirma || proposalRecord.firma,
            yetkili: data.extracted?.clientYetkili || proposalRecord.yetkili,
            tarih: data.extracted?.tarih || proposalRecord.tarih,
            teklifNo: data.extracted?.teklifNo || proposalRecord.teklifNo,
            currency: updatedCurrency,
            itemCount: extractedItems?.length || proposalRecord.itemCount || 0,
            subtotal: data.extracted?.subtotal ?? proposalRecord.subtotal,
            vat: data.extracted?.vat ?? proposalRecord.vat,
            grandTotal: data.extracted?.grandTotal ?? proposalRecord.grandTotal,
            savedHTML: cleanHTML,
            payload: {
              ...existingPayload,
              clientFirma: data.extracted?.clientFirma || existingPayload.clientFirma,
              clientYetkili: data.extracted?.clientYetkili || existingPayload.clientYetkili,
              clientTel: data.extracted?.clientTel || existingPayload.clientTel,
              clientEmail: data.extracted?.clientEmail || existingPayload.clientEmail,
              clientRef: data.extracted?.clientRef || existingPayload.clientRef,
              vendorFirma: data.extracted?.vendorFirma || existingPayload.vendorFirma,
              vendorYetkili: data.extracted?.vendorYetkili || existingPayload.vendorYetkili,
              vendorTel: data.extracted?.vendorTel || existingPayload.vendorTel,
              vendorEmail: data.extracted?.vendorEmail || existingPayload.vendorEmail,
              vendorRef: data.extracted?.vendorRef || existingPayload.vendorRef,
              teslimSuresi: data.extracted?.teslimSuresi || existingPayload.teslimSuresi,
              odemeBilgisi: data.extracted?.odemeBilgisi || existingPayload.odemeBilgisi,
              kdvRate: data.extracted?.kdvRate ?? existingPayload.kdvRate,
              tarih: data.extracted?.tarih || existingPayload.tarih,
              teklifNo: data.extracted?.teklifNo || existingPayload.teklifNo,
              currency: updatedCurrency,
              items: extractedItems,
              itemCount: extractedItems?.length || 0,
              subtotal: data.extracted?.subtotal ?? existingPayload.subtotal,
              vat: data.extracted?.vat ?? existingPayload.vat,
              grandTotal: data.extracted?.grandTotal ?? existingPayload.grandTotal,
              savedHTML: cleanHTML
            }
          };

          // AsyncStorage'a kaydet
          try {
            const recordId = updated.id || proposalRecord.id || Date.now().toString();
            updated.id = recordId;
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            const list = stored ? JSON.parse(stored) : [];
            const exists = list.some(it => String(it.id) === String(recordId));
            const nextList = exists
              ? list.map(it => String(it.id) === String(recordId) ? updated : it)
              : [updated, ...list];
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));

            const parsedNum = parseInt(updated.teklifNo, 10);
            if (!isNaN(parsedNum)) {
              await AsyncStorage.setItem(LAST_TEKLIF_NO_KEY, String(parsedNum));
            }
          } catch (e) {
            console.log('Storage kayıt hatası:', e);
          }

          // Callback çağır
          if (onSaveUpdatedRecord) {
            onSaveUpdatedRecord(updated, cleanHTML);
          }

          Alert.alert('Kaydedildi', 'Değişiklikleriniz başarıyla kaydedildi.');
        }
      } else if (data.type === 'SYNC_UPDATE') {
        if (data.html) {
          setCurrentHTML(data.html);
        }
      }
    } catch (err) {
      console.log('WebView mesaj hatası:', err);
    }
  };

  // PDF Olarak Paylaş
  const handleShare = async () => {
    if (!proposalRecord) return;
    setIsExporting(true);
    try {
      const payload = proposalRecord.payload || proposalRecord;
      await exportAndSharePDF(payload, currentHTML);
    } catch (err) {
      Alert.alert('Hata', 'PDF paylaşılamadı: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
        {/* ÜST BAŞLIK BARI */}
        <View style={styles.header}>
          {/* Sol: Kapat */}
          <TouchableOpacity
            style={styles.btnHeaderAction}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={20} color={MS.textPrimary} />
            <Text style={styles.btnHeaderActionText}>Kapat</Text>
          </TouchableOpacity>

          {/* Orta: Boş / Sade */}
          <View style={styles.titleContainer} />

          {/* Sağ: Düzenle / Tamam ve (Paylaş | Para Birimi) */}
          <View style={styles.rightActions}>
            {/* Düzenle / Tamam Butonu */}
            <TouchableOpacity
              style={[styles.btnEditToggle, isEditing && styles.btnEditToggleActive]}
              onPress={handleToggleOrSave}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isEditing ? 'checkmark-circle' : 'create-outline'}
                size={16}
                color={isEditing ? '#ffffff' : MS.accent}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.btnEditToggleText, isEditing && styles.btnEditToggleTextActive]}>
                {isEditing ? 'Tamam' : 'Düzenle'}
              </Text>
            </TouchableOpacity>

            {/* Düzenleme modunda DEĞİLSE: Paylaş Butonu */}
            {!isEditing && (
              <Animated.View
                entering={FadeIn.duration(360).easing(Easing.out(Easing.cubic))}
                exiting={FadeOut.duration(280).easing(Easing.in(Easing.cubic))}
              >
                <TouchableOpacity
                  style={styles.btnShare}
                  onPress={handleShare}
                  disabled={isExporting}
                  activeOpacity={0.7}
                >
                  {isExporting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="share-outline" size={16} color="#ffffff" style={{ marginRight: 5 }} />
                      <Text style={styles.btnShareText}>Paylaş</Text>
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Düzenleme modundaysa: Para Birimi Seçici Buton */}
            {isEditing && (
              <Animated.View
                entering={FadeIn.duration(360).easing(Easing.out(Easing.cubic))}
                exiting={FadeOut.duration(280).easing(Easing.in(Easing.cubic))}
              >
                <TouchableOpacity
                  style={[
                    styles.btnCurrencyToggle,
                    currencyDropdownVisible && styles.btnCurrencyToggleOpen
                  ]}
                  onPress={() => setCurrencyDropdownVisible(prev => !prev)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.btnCurrencyToggleBadge}>
                    {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₺'}
                  </Text>
                  <Text style={styles.btnCurrencyToggleText}>{currency}</Text>
                  <Ionicons
                    name={currencyDropdownVisible ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color="#ffffff"
                    style={{ marginLeft: 4 }}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </View>

        {/* DÜZENLEME MODU BİLGİLENDİRME ÇUBUĞU */}

        {/* PARA BİRİMİ AÇILIR KUTUSU (DROPDOWN MODAL) */}
        {isEditing && currencyDropdownVisible && (
          <Animated.View
            entering={FadeInDown.duration(240).easing(Easing.out(Easing.cubic))}
            exiting={FadeOutUp.duration(180)}
            style={styles.currencyDropdownContainer}
          >
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownHeaderText}>PARA BİRİMİ SEÇİN</Text>
            </View>

            <TouchableOpacity
              style={[styles.dropdownItem, currency === 'USD' && styles.dropdownItemActive]}
              onPress={() => handleChangeCurrency('USD')}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownItemLeft}>
                <Text style={styles.currencySymbolDirect}>$</Text>
                <Text style={[styles.dropdownItemText, currency === 'USD' && styles.dropdownItemTextActive]}>
                  USD (Dolar)
                </Text>
              </View>
              {currency === 'USD' && (
                <Ionicons name="checkmark-circle" size={19} color="#107c41" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dropdownItem, currency === 'TL' && styles.dropdownItemActive]}
              onPress={() => handleChangeCurrency('TL')}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownItemLeft}>
                <Text style={styles.currencySymbolDirect}>₺</Text>
                <Text style={[styles.dropdownItemText, currency === 'TL' && styles.dropdownItemTextActive]}>
                  TL (Türk Lirası)
                </Text>
              </View>
              {currency === 'TL' && (
                <Ionicons name="checkmark-circle" size={19} color="#107c41" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dropdownItem, styles.dropdownItemLast, currency === 'EUR' && styles.dropdownItemActive]}
              onPress={() => handleChangeCurrency('EUR')}
              activeOpacity={0.7}
            >
              <View style={styles.dropdownItemLeft}>
                <Text style={styles.currencySymbolDirect}>€</Text>
                <Text style={[styles.dropdownItemText, currency === 'EUR' && styles.dropdownItemTextActive]}>
                  EUR (Euro)
                </Text>
              </View>
              {currency === 'EUR' && (
                <Ionicons name="checkmark-circle" size={19} color="#107c41" />
              )}
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* WEBVIEW GÖRÜNTÜLEYİCİ */}
        <View style={styles.webviewContainer}>
          {Platform.OS === 'web' ? (
            <iframe
              srcDoc={initialHTML}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Teklif Önizleme"
            />
          ) : (
            <WebView
              ref={webViewRef}
              originWhitelist={['*']}
              source={{ html: initialHTML }}
              style={styles.webview}
              scalesPageToFit={Platform.OS === 'android' ? false : true}
              bounces={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              setBuiltInZoomControls={true}
              setDisplayZoomControls={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={true}
              onMessage={handleWebViewMessage}
              onLoadEnd={() => {
                if (webViewRef.current) {
                  webViewRef.current.injectJavaScript(`
                    ${forceEditableStylesJS}
                    ${isEditing ? 'if (window.setEditingMode) { window.setEditingMode(true); }' : ''}
                    true;
                  `);
                }
              }}
              injectedJavaScript={`
                window.ReactNativeWebView = window.ReactNativeWebView || window;
                ${forceEditableStylesJS}
                ${isEditing ? 'if (window.setEditingMode) { window.setEditingMode(true); }' : ''}
                true;
              `}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#ffffff',
    zIndex: 10
  },
  btnHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6
  },
  btnHeaderActionText: {
    fontSize: 14,
    fontFamily: MS.fontFamily,
    color: MS.textPrimary,
    marginLeft: 2
  },
  titleContainer: {
    flex: 1
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  btnEditToggle: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: MS.accent
  },
  btnEditToggleActive: {
    backgroundColor: '#107c41',
    borderColor: '#107c41'
  },
  btnEditToggleText: {
    fontSize: 13,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: MS.accent
  },
  btnEditToggleTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  btnShare: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0078d4',
    paddingHorizontal: 12,
    borderRadius: 6
  },
  btnShareText: {
    fontSize: 13,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#ffffff'
  },

  // Para Birimi Seçme Butonu (Tamam butonu ile tam aynı yükseklikte)
  btnCurrencyToggle: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#107c41',
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#107c41'
  },
  btnCurrencyToggleOpen: {
    backgroundColor: '#0b5a2e',
    borderColor: '#0b5a2e'
  },
  btnCurrencyToggleBadge: {
    fontSize: 13,
    fontWeight: '800',
    color: '#a7f3d0',
    marginRight: 4
  },
  btnCurrencyToggleText: {
    fontSize: 13,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#ffffff'
  },

  // Para Birimi Dropdown Kutusu (Ferah & Boşluklu)
  currencyDropdownContainer: {
    position: 'absolute',
    top: 58,
    right: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 215,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10
  },
  dropdownHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontFamily: MS.fontFamily,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9
  },
  dropdownItemActive: {
    backgroundColor: '#f0fdf4'
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  currencySymbolDirect: {
    fontSize: 17,
    fontFamily: MS.fontFamily,
    fontWeight: '800',
    color: '#000000',
    width: 22,
    textAlign: 'center',
    marginRight: 10
  },
  dropdownItemText: {
    fontSize: 13.5,
    fontFamily: MS.fontFamily,
    color: '#1e293b',
    fontWeight: '600'
  },
  dropdownItemTextActive: {
    color: '#107c41',
    fontWeight: '700'
  },

  editModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderBottomWidth: 1,
    borderBottomColor: '#a7f3d0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    zIndex: 9
  },
  editModeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  editModeBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: MS.fontFamily,
    color: '#065f46',
    lineHeight: 16
  },
  editModeBannerBold: {
    fontWeight: '700',
    color: '#047857'
  },

  webviewContainer: {
    flex: 1,
    backgroundColor: '#e9ecef'
  },
  webview: {
    flex: 1,
    backgroundColor: '#e9ecef'
  }
});
