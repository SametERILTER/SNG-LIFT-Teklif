import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MS } from '../constants/theme';

/**
 * Başarı Rozeti (Success Morphing Button)
 * - Butona tıklandığında içeri çekilip bir onay dairesine dönüşür.
 * - İçinde yeşil bir onay işareti (Checkmark) ve hafif dışarı yayılan başarı halkası belirir.
 * - Kesinlikle yaylanmasız / no spring (Saf Cubic Out & Quad Out easing).
 */
const MorphingSuccessButton = forwardRef(function MorphingSuccessButton({
  title = 'PDF OLUŞTUR',
  icon = 'document-text-outline',
  onPress,
  disabled = false,
  style,
  backgroundColor = MS.accent,
  successColor = '#107c41',
  buttonHeight = 48
}, ref) {
  const [isMorphing, setIsMorphing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  // Animasyon Shared Değerleri
  const animProgress = useSharedValue(0); // 0: Normal Buton, 1: Daire
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const pressScale = useSharedValue(1);

  const reset = () => {
    setIsMorphing(false);
    setIsSuccess(false);
    animProgress.value = 0;
    checkScale.value = 0;
    checkOpacity.value = 0;
    ringScale.value = 1;
    ringOpacity.value = 0;
    pressScale.value = 1;
  };

  useImperativeHandle(ref, () => ({
    reset
  }));

  const handleLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && containerWidth === 0) {
      setContainerWidth(w);
    }
  };

  const handlePressIn = () => {
    if (isMorphing || disabled) return;
    pressScale.value = withTiming(0.96, {
      duration: 100,
      easing: Easing.out(Easing.quad)
    });
  };

  const handlePressOut = () => {
    if (isMorphing || disabled) return;
    pressScale.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.quad)
    });
  };

  const handleTrigger = async () => {
    if (isMorphing || disabled) return;

    if (onPress) {
      const result = await onPress();
      // Eğer doğrulama başarısızsa (false dönerse) morflamayı başlatma
      if (result === false) return;
    }

    setIsMorphing(true);

    // 1. Aşama: Buton içeri çekilerek daireye morflanır (Cubic Out, Yaylanma YOK)
    animProgress.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic)
    });

    // 2. Aşama: Yeşil Onay Rozeti (Checkmark) ve Başarı Halkası belirir
    setTimeout(() => {
      setIsSuccess(true);
      checkScale.value = withTiming(1, {
        duration: 220,
        easing: Easing.out(Easing.cubic)
      });
      checkOpacity.value = withTiming(1, {
        duration: 180,
        easing: Easing.out(Easing.quad)
      });

      ringScale.value = 1;
      ringOpacity.value = 0.75;
      ringScale.value = withTiming(1.6, {
        duration: 320,
        easing: Easing.out(Easing.cubic)
      });
      ringOpacity.value = withTiming(0, {
        duration: 320,
        easing: Easing.out(Easing.quad)
      });
    }, 240);
  };

  const buttonAnimatedStyle = useAnimatedStyle(() => {
    const targetCircleSize = buttonHeight;
    const currentWidth = containerWidth > 0
      ? containerWidth - (containerWidth - targetCircleSize) * animProgress.value
      : undefined;

    const borderRadius = (targetCircleSize / 2) * animProgress.value;

    return {
      width: currentWidth,
      height: buttonHeight,
      borderRadius: borderRadius,
      transform: [{ scale: pressScale.value }],
      backgroundColor: animProgress.value > 0.5 ? successColor : backgroundColor
    };
  });

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - animProgress.value,
    transform: [{ scale: 1 - animProgress.value * 0.25 }]
  }));

  const checkAnimatedStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: checkScale.value }]
  }));

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }]
  }));

  return (
    <View style={[styles.outerContainer, style]} onLayout={handleLayout}>
      <Pressable
        onPress={handleTrigger}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isMorphing}
        style={styles.pressable}
      >
        {/* Dışarı Yayılan Başarı Halkası */}
        <Animated.View
          style={[
            styles.successRing,
            {
              width: buttonHeight,
              height: buttonHeight,
              borderRadius: buttonHeight / 2,
              borderColor: successColor
            },
            ringAnimatedStyle
          ]}
        />

        {/* Morflanan Buton Gövdesi */}
        <Animated.View style={[styles.buttonBody, buttonAnimatedStyle]}>
          {/* Normal Buton Metni ve İkonu */}
          {!isSuccess && (
            <Animated.View style={[styles.contentRow, contentAnimatedStyle]}>
              <Ionicons name={icon} size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.buttonText}>{title}</Text>
            </Animated.View>
          )}

          {/* Başarı Onay Rozeti (Checkmark) */}
          {isSuccess && (
            <Animated.View style={[styles.checkWrapper, checkAnimatedStyle]}>
              <Ionicons name="checkmark-sharp" size={24} color="#ffffff" />
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
});

export default MorphingSuccessButton;

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pressable: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%'
  },
  buttonBody: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  buttonText: {
    fontFamily: MS.fontFamilySemiBold,
    fontSize: 12,
    color: '#ffffff',
    letterSpacing: 0.3
  },
  checkWrapper: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  successRing: {
    position: 'absolute',
    borderWidth: 2.5,
    zIndex: 1
  }
});
