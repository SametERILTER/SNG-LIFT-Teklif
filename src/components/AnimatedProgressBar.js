import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing
} from 'react-native-reanimated';
import { MS } from '../constants/theme';

/**
 * Kademeli Doldurulan İlerleme Çubuğu (Staggered Progress Bar)
 * - Her çubuk sırayla soldan sağa doğru dolar.
 * - Easing: Cubic Out (Kesinlikle yaylanmasız / no spring).
 */
export default function AnimatedProgressBar({
  ratio = 0, // 0 - 100
  index = 0,
  staggerDelay = 50,
  duration = 550,
  barColor = '#107c41',
  trackColor = '#e2e8f0',
  height = 8
}) {
  const widthVal = useSharedValue(0);

  useEffect(() => {
    widthVal.value = 0;
    const target = Math.max(6, Math.min(100, ratio));
    const timer = setTimeout(() => {
      widthVal.value = withTiming(target, {
        duration: duration,
        easing: Easing.out(Easing.cubic)
      });
    }, index * staggerDelay);

    return () => clearTimeout(timer);
  }, [ratio, index, staggerDelay, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${widthVal.value}%`
  }));

  return (
    <View style={[styles.track, { backgroundColor: trackColor, height }]}>
      <Animated.View style={[styles.fill, { backgroundColor: barColor, height }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 0,
    overflow: 'hidden'
  },
  fill: {
    borderRadius: 0
  }
});
