import { Stack, useRouter } from 'expo-router'
import { StateMessage } from '../src/components/StateMessage'

/** A deep link to a route the app doesn't have. */
export default function NotFoundScreen() {
  const router = useRouter()
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <StateMessage
        title="This page doesn't exist"
        actionLabel="Back to home"
        onAction={() => router.replace('/')}
      />
    </>
  )
}
