import { Text, View, StyleSheet } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@domus/backend/convex/_generated/api";

export default function Home() {
  const tasks = useQuery(api.tasks.list);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DomusOS</Text>
      <Text>{JSON.stringify(tasks, null, 2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "bold" },
});
