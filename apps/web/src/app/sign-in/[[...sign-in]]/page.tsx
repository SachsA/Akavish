import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex justify-center py-16 px-4">
      <SignIn />
    </div>
  )
}
