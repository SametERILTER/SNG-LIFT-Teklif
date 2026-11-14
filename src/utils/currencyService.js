import AsyncStorage from '@react-native-async-storage/async-storage';
import { CURRENCY_RATES_KEY } from '../constants/theme';

export const DEFAULT_RATES = {
  usd: '49.36',
  eur: '55.23',
  loading: false,
  lastUpdated: null
};

/**
 * AsyncStorage'tan son kaydedilmiş döviz kurlarını anında getirir.
 * Sayfa ilk açıldığında ağ isteğini beklemeden anında ekrana basmak için kullanılır.
 */
export const getCachedRates = async () => {
  try {
    const stored = await AsyncStorage.getItem(CURRENCY_RATES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && parsed.usd && parsed.eur) {
        return {
          usd: parsed.usd,
          eur: parsed.eur,
          loading: false,
          lastUpdated: parsed.lastUpdated || null
        };
      }
    }
  } catch (err) {
    console.log('Kur önbellek okuma hatası:', err);
  }
  return { ...DEFAULT_RATES };
};

/**
 * 1. Kaynak: open.er-api.com (Hızlı, küresel CDN, ücretsiz ve sınırsız)
 */
const fetchFromOpenErApi = async (timeoutMs = 4500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const tryRate = data?.rates?.TRY;
    const eurRateToUsd = data?.rates?.EUR;
    if (tryRate && !isNaN(tryRate) && tryRate > 20 && tryRate < 200) {
      const usdVal = tryRate;
      const eurVal = eurRateToUsd ? tryRate / eurRateToUsd : tryRate * 1.11;
      return {
        usd: usdVal.toFixed(2),
        eur: eurVal.toFixed(2),
        source: 'open.er-api'
      };
    }
  } catch (e) {
    clearTimeout(timer);
  }
  return null;
};

/**
 * 2. Kaynak: Frankfurter API (Avrupa Merkez Bankası verileri tabanlı, hızlı)
 */
const fetchFromFrankfurter = async (timeoutMs = 4500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD&to=TRY', { signal: controller.signal }),
      fetch('https://api.frankfurter.app/latest?from=EUR&to=TRY', { signal: controller.signal })
    ]);
    clearTimeout(timer);
    if (!usdRes.ok || !eurRes.ok) return null;
    const usdData = await usdRes.json();
    const eurData = await eurRes.json();
    const usdVal = usdData?.rates?.TRY;
    const eurVal = eurData?.rates?.TRY;
    if (usdVal && eurVal && !isNaN(usdVal) && !isNaN(eurVal)) {
      return {
        usd: Number(usdVal).toFixed(2),
        eur: Number(eurVal).toFixed(2),
        source: 'frankfurter'
      };
    }
  } catch (e) {
    clearTimeout(timer);
  }
  return null;
};

/**
 * 3. Kaynak: Truncgil Finans API (Yerel serbest piyasa fallback)
 */
const fetchFromTruncgil = async (timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://finans.truncgil.com/v3/today.json', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const parseRateStr = (val) => {
      if (!val) return null;
      const clean = String(val).replace(/[^0-9.,]/g, '').replace(',', '.');
      const num = parseFloat(clean);
      return !isNaN(num) && num > 20 && num < 200 ? num : null;
    };
    const usdVal = parseRateStr(data?.USD?.Selling || data?.USD?.Buying);
    const eurVal = parseRateStr(data?.EUR?.Selling || data?.EUR?.Buying);
    if (usdVal && eurVal) {
      return {
        usd: usdVal.toFixed(2),
        eur: eurVal.toFixed(2),
        source: 'truncgil'
      };
    }
  } catch (e) {
    clearTimeout(timer);
  }
  return null;
};

/**
 * Canlı döviz kurlarını yedekli API mimarisiyle çeker.
 * Başarılı olursa AsyncStorage'a kaydeder; başarısız olursa önbellekteki son kuru döndürür.
 */
export const fetchLiveRates = async () => {
  try {
    // 1. Birincil hızlı servis: open.er-api.com
    let result = await fetchFromOpenErApi(4000);

    // 2. İkincil yedek servis: Frankfurter
    if (!result) {
      result = await fetchFromFrankfurter(4000);
    }

    // 3. Üçüncül yedek servis: Truncgil
    if (!result) {
      result = await fetchFromTruncgil(5000);
    }

    if (result && result.usd && result.eur) {
      const payload = {
        usd: result.usd,
        eur: result.eur,
        loading: false,
        lastUpdated: Date.now()
      };
      // Önbelleğe kaydet
      try {
        await AsyncStorage.setItem(CURRENCY_RATES_KEY, JSON.stringify(payload));
      } catch (e) {
        // ignore
      }
      return payload;
    }
  } catch (err) {
    console.log('Canlı kur çekme genel hatası:', err);
  }

  // Eğer tüm ağ istekleri başarısız olduysa, önbellekteki son geçerli kuru getir
  const cached = await getCachedRates();
  return { ...cached, loading: false };
};
