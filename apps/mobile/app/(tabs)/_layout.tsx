import { Tabs } from 'expo-router'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#09090b', borderTopColor: '#27272a' },
        tabBarActiveTintColor: '#0ea5e9',
        tabBarInactiveTintColor: '#71717a',
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#fff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
        }}
      />
      <Tabs.Screen
        name="leaks"
        options={{
          title: 'Leaks',
          tabBarLabel: 'Leaks',
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'Reviews',
          tabBarLabel: 'Reviews',
        }}
      />
      <Tabs.Screen
        name="esport"
        options={{
          title: 'Esport',
          tabBarLabel: 'Esport',
        }}
      />
    </Tabs>
  )
}
