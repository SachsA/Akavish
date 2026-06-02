import { View, Text, StyleSheet } from 'react-native'

export default function EsportScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Esport — coming soon</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' },
  text: { color: '#71717a' },
})
