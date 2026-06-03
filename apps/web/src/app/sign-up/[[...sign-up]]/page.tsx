import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex justify-center py-16 px-4">
      <SignUp />
    </div>
  )
}
