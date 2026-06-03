import Link from "next/link";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/**
 * A friendly fallback shown when a logged-in user lands on a page that
 * doesn't match their account (e.g. an admin opening the student dashboard).
 * It NEVER redirects, which prevents the infinite redirect loop that caused
 * the "black screen + lag" bug. It offers a clean way to sign out / switch.
 */
export function AccountNotice({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="min-h-screen premium-gradient flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-8 max-w-md w-full text-center border border-averna-neon/30 animate-fade-in">
        <h1 className="text-2xl font-bold text-white mb-3">{title}</h1>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/">
            <Button
              variant="outline"
              className="w-full border-averna-neon text-averna-neon hover:bg-averna-primary/20"
            >
              Home
            </Button>
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/auth/signin" });
            }}
          >
            <Button className="w-full neon-button bg-averna-primary hover:bg-averna-light">
              Sign in as another user
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
