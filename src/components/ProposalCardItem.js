import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeInDown,
  LinearTransition
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MS } from '../constants/theme';
import { getSmartDateLabel } from '../utils/dateUtils';
import AnimatedCounter from './AnimatedCounter';

function ProposalCardItem({
  prop,
  idx = 0,
  formatUSD,
  onPress,
  onLongPress,
  isSelectionMode = false,
  isSelected = false,
  deleteCardExiting,
  animatedPrice = false,
  animateEntering = false
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, {
      duration: 100,
      easing: Easing.out(Easing.quad)
    });
    opacity.value = withTiming(0.92, {
      duration: 100,
      easing: Easing.out(Easing.quad)
    });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.quad)
    });
    opacity.value = withTiming(1, {
      duration: 120,
      easing: Easing.out(Easing.quad)
    });
  };

  // Yalnızca ilk 5 kart için hafif giriş animasyonu ver, geri kalanını doğrudan ve kasmadan yükle
  const enteringAnim = animateEntering && idx < 5
    ? FadeInDown.delay(idx * 30).duration(220).easing(Easing.out(Easing.cubic))
    : undefined;

  const wrapperRef = React.useRef(null);

  const handleCardPress = () => {
    if (isSelectionMode) {
      if (onPress) onPress(prop);
      return;
    }
    if (wrapperRef.current && wrapperRef.current.measureInWindow) {
      wrapperRef.current.measureInWindow((x, y, width, height) => {
        if (onPress) {
          onPress(prop, { x, y, width, height });
        }
      });
    } else {
      if (onPress) onPress(prop);
    }
  };

  const handleCardLongPress = () => {
    if (onLongPress) {
      onLongPress(prop);
    }
  };

  return (
    <Animated.View
      ref={wrapperRef}
      collapsable={false}
      entering={enteringAnim}
      exiting={deleteCardExiting}
      layout={animateEntering ? LinearTransition.duration(300).easing(Easing.out(Easing.cubic)) : undefined}
      style={styles.cardWrapper}
    >
      <Pressable
        onPress={handleCardPress}
        onLongPress={handleCardLongPress}
        delayLongPress={240}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{ width: '100%' }}
      >
        <Animated.View
          collapsable={false}
          style={[
            styles.proposalCard,
            isSelected && styles.proposalCardSelected,
            cardAnimatedStyle
          ]}
        >
          {/* MÜŞTERİ FİRMA ADI */}
          <Text style={styles.proposalClientName} numberOfLines={1}>
            {prop.firma || 'Müşteri Belirtilmedi'}
          </Text>

          {prop.yetkili ? (
            <Text style={styles.proposalClientYetkili}>Yetkili: {prop.yetkili}</Text>
          ) : null}

          <View style={styles.proposalCardBottom}>
            <Text style={styles.proposalTotalLabel}>Toplam Tutar</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {animatedPrice ? (
                <AnimatedCounter
                  value={prop.grandTotal}
                  currency={prop.currency || prop.payload?.currency}
                  style={styles.proposalTotalAmount}
                />
              ) : (
                <Text style={styles.proposalTotalAmount}>
                  {formatUSD(prop.grandTotal, prop.currency || prop.payload?.currency)}
                </Text>
              )}

              {/* Seçim Modu İkonu veya Standart Detay İkonu */}
              {isSelectionMode ? (
                isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#107c41"
                    style={{ marginLeft: 8 }}
                  />
                ) : (
                  <Ionicons
                    name="ellipse-outline"
                    size={22}
                    color="#94a3b8"
                    style={{ marginLeft: 8 }}
                  />
                )
              ) : (
                <Ionicons
                  name="ellipsis-horizontal-circle-outline"
                  size={20}
                  color={MS.accent}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: '100%',
    marginBottom: 10
  },
  proposalCard: {
    backgroundColor: '#f3f3f3ff',
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: 14,
    borderRadius: 0
  },
  proposalCardSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: '#107c41'
  },
  proposalClientName: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#111827',
    marginBottom: 2
  },
  proposalClientYetkili: {
    fontFamily: MS.fontFamilyMedium,
    fontSize: 12,
    color: '#4b5563',
    marginTop: 2
  },
  proposalCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10
  },
  proposalTotalLabel: {
    fontFamily: MS.fontFamily,
    fontSize: 12,
    color: '#6b7280'
  },
  proposalTotalAmount: {
    fontFamily: MS.fontFamilyBold,
    fontSize: 15,
    color: '#111827'
  }
});

function areEqual(prevProps, nextProps) {
  return (
    prevProps.prop.id === nextProps.prop.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.prop.grandTotal === nextProps.prop.grandTotal &&
    prevProps.prop.firma === nextProps.prop.firma &&
    prevProps.prop.yetkili === nextProps.prop.yetkili &&
    prevProps.prop.tarih === nextProps.prop.tarih &&
    prevProps.animateEntering === nextProps.animateEntering
  );
}

export default React.memo(ProposalCardItem, areEqual);
