import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing
} from 'react-native-reanimated';

/**
 * Pürüzsüz Shimmer / Nabız İskelet Parçası (Skeleton Item)
 * - Kesinlikle yaylanmasız / no spring (Quad In/Out yumuşak nabız).
 */
export function SkeletonItem({
  width = '100%',
  height = 16,
  borderRadius = 0,
  style
}) {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.85, {
          duration: 750,
          easing: Easing.inOut(Easing.quad)
        }),
        withTiming(0.35, {
          duration: 750,
          easing: Easing.inOut(Easing.quad)
        })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <Animated.View
      style={[
        styles.skeletonBase,
        {
          width: width,
          height: height,
          borderRadius: borderRadius
        },
        animatedStyle,
        style
      ]}
    />
  );
}

/**
 * Teklif Kartı İskeleti (Proposal Card Skeleton)
 * - Gerçek ProposalCardItem yapısıyla birebir uyumlu.
 */
export function ProposalCardSkeleton() {
  return (
    <View style={styles.cardSkeletonWrapper}>
      <View style={styles.cardSkeletonBody}>
        {/* Firma Adı İskeleti */}
        <SkeletonItem width="58%" height={16} style={{ marginBottom: 6 }} />

        {/* Yetkili Adı İskeleti */}
        <SkeletonItem width="36%" height={12} style={{ marginBottom: 2 }} />

        {/* Ayırıcı Çizgi */}
        <View style={styles.divider} />

        {/* Alt Satır: Toplam Tutar Etiketi & Fiyat */}
        <View style={styles.cardBottomRow}>
          <SkeletonItem width="26%" height={12} />
          <SkeletonItem width="34%" height={16} />
        </View>
      </View>
    </View>
  );
}

/**
 * Teklif Listesi İskelet Grubu (Proposal List Skeleton)
 */
export function ProposalListSkeleton({ count = 3, showHeader = true }) {
  return (
    <View style={styles.listSkeletonContainer}>
      {showHeader && (
        <View style={styles.dateHeaderSkeletonRow}>
          <SkeletonItem width="32%" height={14} style={{ marginBottom: 10 }} />
        </View>
      )}

      {Array.from({ length: count }).map((_, idx) => (
        <ProposalCardSkeleton key={`skeleton-card-${idx}`} />
      ))}
    </View>
  );
}

/**
 * İstatistik Sayfası İskeleti (Statistics Skeleton)
 */
export function StatisticsSkeleton() {
  return (
    <View style={styles.statsSkeletonContainer}>
      {/* Büyük Başlık İskeleti */}
      <View style={{ marginBottom: 18 }}>
        <SkeletonItem width="40%" height={26} style={{ marginBottom: 6 }} />
        <SkeletonItem width="30%" height={28} style={{ marginBottom: 6 }} />
        <SkeletonItem width="60%" height={12} />
      </View>

      {/* Ana Hacim Kartı İskeleti */}
      <View style={styles.mainVolumeSkeletonCard}>
        <View style={styles.skeletonHeaderRow}>
          <SkeletonItem width="45%" height={14} />
          <SkeletonItem width="20%" height={18} />
        </View>
        <View style={{ gap: 12, marginTop: 12 }}>
          <View style={styles.skeletonAmountRow}>
            <SkeletonItem width="30%" height={12} />
            <SkeletonItem width="35%" height={18} />
          </View>
          <View style={styles.skeletonAmountRow}>
            <SkeletonItem width="28%" height={12} />
            <SkeletonItem width="32%" height={18} />
          </View>
        </View>
      </View>

      {/* 2'li Metrik Kartları İskeleti */}
      <View style={styles.metricsSkeletonRow}>
        <View style={styles.metricSkeletonCard}>
          <SkeletonItem width="50%" height={12} style={{ marginBottom: 8 }} />
          <SkeletonItem width="40%" height={22} style={{ marginBottom: 6 }} />
          <SkeletonItem width="60%" height={10} />
        </View>
        <View style={styles.metricSkeletonCard}>
          <SkeletonItem width="50%" height={12} style={{ marginBottom: 8 }} />
          <SkeletonItem width="40%" height={22} style={{ marginBottom: 6 }} />
          <SkeletonItem width="60%" height={10} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: '#cbd5e1'
  },
  cardSkeletonWrapper: {
    width: '100%',
    marginBottom: 10
  },
  cardSkeletonBody: {
    backgroundColor: '#f3f3f3',
    padding: 14,
    borderRadius: 0,
    borderWidth: 0
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 10
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  listSkeletonContainer: {
    width: '100%'
  },
  dateHeaderSkeletonRow: {
    paddingVertical: 4
  },
  statsSkeletonContainer: {
    width: '100%',
    paddingTop: 4
  },
  mainVolumeSkeletonCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 0,
    padding: 16,
    marginBottom: 14
  },
  skeletonHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  skeletonAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  metricsSkeletonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14
  },
  metricSkeletonCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 0,
    padding: 12
  }
});
