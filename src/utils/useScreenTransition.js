import { useCallback } from 'react';

/**
 * Sayfa Geçiş & Geri Dönüş Yardımcısı
 * React Navigation native-stack `slide_from_right` animasyonu ile çalışır.
 */
export function useScreenTransition(navigation) {
  const handleGoBack = useCallback(() => {
    if (navigation && navigation.goBack) {
      navigation.goBack();
    }
  }, [navigation]);

  return {
    animatedStyle: { flex: 1, backgroundColor: '#ffffff' },
    handleGoBack
  };
}
