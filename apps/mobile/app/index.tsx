import { Text, View, StyleSheet } from "react-native";

// Resident onboarding via invite lands here (ticket 2). No committee auth on
// mobile in this ticket — that flow is web-only. Convex client is wired in
// _layout.tsx and ready for the invite-redemption screen.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>DomusOS</Text>
      <Text style={styles.body}>Enter via your building invite.</Text>
      <Text style={styles.hint}>Ask your committee for an invite link.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 12 },
  body: { fontSize: 16 },
  hint: { fontSize: 13, color: "#666", marginTop: 8 },
});
