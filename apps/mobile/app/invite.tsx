import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@domus/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { signIn } = useAuthActions();
  const claimInvite = useMutation(api.members.claimInvite);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This invite link is invalid.");
      return;
    }

    void signIn("anonymous", {})
      .then(() => claimInvite({ token }))
      .then(() => setClaimed(true))
      .catch(() =>
        setError("This invite is invalid, expired, or already claimed."),
      );
  }, [claimInvite, signIn, token]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>DomusOS</Text>
      {error ? <Text role="alert">{error}</Text> : null}
      {claimed ? <Text>You joined your building.</Text> : null}
      {!error && !claimed ? <Text>Joining your building…</Text> : null}
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
});
