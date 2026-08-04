// Animated brand splash shown once on cold start, on top of the whole app tree.
// Plays a short reveal (radar pulse -> mark -> wordmark) then fades itself out
// and calls `onFinish` so the parent can unmount it.
//
// Everything runs on the native driver: no layout props are animated, only
// opacity / transform. This is the one place hardcoded hex is allowed — the
// surface IS the brand gradient, in both light and dark mode.
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { brandGradient, brandGradientStart, brandGradientEnd } from "../lib/theme";

// The wordmark is English and stays LTR even though the app is RTL.
const LETTERS = "DalConnect".split("");

export function BrandSplash({ onFinish }: { onFinish: () => void }) {
  // One value per animated piece, created once and never re-created.
  const fade = useRef(new Animated.Value(1)).current; // whole-screen fade-out
  const markIn = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const letters = useMemo(() => LETTERS.map(() => new Animated.Value(0)), []);

  useEffect(() => {
    // Two concurrent rings, the second half a beat behind, so the pulse never
    // fully empties out.
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const loops = [pulse(ring1, 0), pulse(ring2, 700)];
    loops.forEach((l) => l.start());

    const reveal = Animated.sequence([
      Animated.spring(markIn, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.stagger(
        110,
        letters.map((l) =>
          Animated.timing(l, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        )
      ),
      Animated.delay(500),
      Animated.timing(fade, {
        toValue: 0,
        duration: 480,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    reveal.start(({ finished }) => {
      loops.forEach((l) => l.stop());
      if (finished) onFinish();
    });

    return () => {
      reveal.stop();
      loops.forEach((l) => l.stop());
    };
    // Animated values are stable refs; this must run exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.85, 2.3] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents="none">
      <StatusBar style="light" />
      <LinearGradient
        colors={brandGradient}
        start={brandGradientStart}
        end={brandGradientEnd}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        {/* Radar pulse behind the mark */}
        <View style={styles.ringLayer} pointerEvents="none">
          <Animated.View style={[styles.ring, ringStyle(ring1)]} />
          <Animated.View style={[styles.ring, ringStyle(ring2)]} />
        </View>

        <Animated.View
          style={[
            styles.disc,
            {
              opacity: markIn,
              transform: [
                { scale: markIn.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
              ],
            },
          ]}
        >
          <MaterialCommunityIcons name="hammer-wrench" size={56} color="#ffffff" />
        </Animated.View>

        <View style={styles.word}>
          {LETTERS.map((ch, i) => (
            <Animated.Text
              key={`${ch}-${i}`}
              style={[
                styles.letter,
                {
                  opacity: letters[i],
                  transform: [
                    {
                      translateY: letters[i]!.interpolate({
                        inputRange: [0, 1],
                        outputRange: [22, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 999, elevation: 999, backgroundColor: "#c25d27" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ringLayer: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    marginBottom: 84,
  },
  // Glass disc holding the mark.
  disc: {
    width: 128,
    height: 128,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  // The wordmark is Latin, so it stays LTR regardless of the app's RTL layout.
  word: { flexDirection: "row", marginTop: 26 },
  letter: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 1.5,
    includeFontPadding: false,
  },
});
