import React, { useEffect, useState, useRef } from 'react';
import { Text } from 'react-native';

/**
 * Pürüzsüz Sayı Artış / Canlı Sayaç Animasyonu (Rolling Numbers)
 * - Sıfırdan veya önceki değerden hedef değere doğru pürüzsüzce sayar.
 * - Easing: Cubic Out (Kesinlikle yaylanmasız / no spring).
 * - Finans & borsa uygulamaları tarzı canlı artış / azalış.
 */
export default function AnimatedCounter({
  value = 0,
  currency = null, // 'USD', 'TL', 'EUR', 'TRY' veya null
  isInteger = false,
  prefix = '',
  suffix = '',
  duration = 650,
  startFromZero = true,
  style
}) {
  const numericTarget = Number(value) || 0;
  const [displayValue, setDisplayValue] = useState(startFromZero ? 0 : numericTarget);
  const currentValRef = useRef(startFromZero ? 0 : numericTarget);
  const animFrameRef = useRef(null);

  useEffect(() => {
    const start = currentValRef.current;
    const target = Number(value) || 0;

    // Eğer başlangıç ve hedef aynıysa ve displayValue da zaten hedefteyse çalıştırma
    if (start === target && displayValue === target) {
      return;
    }

    let startTime = null;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Pürüzsüz Cubic Out eğrisi: 1 - (1 - t)^3 (Kesinlikle yaylanmasız)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * easeOut;

      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        currentValRef.current = target;
        setDisplayValue(target);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, duration]);

  const formattedText = () => {
    const num = displayValue || 0;
    let formattedNum = '';

    if (isInteger) {
      formattedNum = Math.round(num).toLocaleString('tr-TR');
    } else {
      formattedNum = num.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }

    if (currency) {
      const curUpper = String(currency).toUpperCase();
      let sym = '$';
      if (curUpper === 'TL' || curUpper === 'TRY' || curUpper === '₺') {
        sym = '₺';
      } else if (curUpper === 'EUR' || curUpper === '€') {
        sym = '€';
      }
      return `${sym} ${formattedNum}`;
    }

    return `${prefix}${formattedNum}${suffix}`;
  };

  return <Text style={style}>{formattedText()}</Text>;
}

