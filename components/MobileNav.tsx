"use client";

import Link from "next/link";
import Image from "next/image";
import { Menu, Home, ListChecks, Settings, LogOut } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type MobileNavProps = {
  user?: Partial<User> & { profileURL?: string };
};

export default function MobileNav({ user }: MobileNavProps) {
  const avatar = user?.profileURL || "/ai-avatar.png";
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-between">
      <Sheet>
        <SheetTrigger className="glass-card px-3 py-2 flex items-center gap-2">
          <Menu className="size-5" />
          <span className="font-medium">Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="bg-transparent border-none p-0">
          <SheetTitle className="sr-only">Mobile navigation</SheetTitle>
          <aside className="glass-panel p-4 h-full flex flex-col gap-4 w-full">
            <Link href="/" className="flex items-center gap-2 px-2">
              <Image src="/logo.svg" alt="PrepWise" width={32} height={28} />
              <h2 className="text-primary-100">PrepWise</h2>
            </Link>

            <nav className="mt-2 flex-1">
              <ul className="space-y-1 list-none m-0 p-0">
                <li>
                  <Link href="/" className="nav-link" data-active={pathname === "/"}>
                    <Home className="size-4" />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li>
                  <Link href="/interview" className="nav-link" data-active={pathname?.startsWith("/interview")}>
                    <ListChecks className="size-4" />
                    <span>Interviews</span>
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className="nav-link" data-active={pathname?.startsWith("/settings")}>
                    <Settings className="size-4" />
                    <span>Settings</span>
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="mt-auto">
              <div className="glass-card flex items-center gap-3 p-3">
                <Image
                  src={avatar}
                  alt={user?.name || "User"}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{user?.name || "User"}</p>
                  <p className="text-xs text-light-400 truncate">{user?.email || "Signed in"}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link href="/settings" className="nav-link flex-1 justify-center">
                  <Settings className="size-4" />
                  <span>Settings</span>
                </Link>
                <Link href="/sign-out" className="nav-link flex-1 justify-center">
                  <LogOut className="size-4" />
                  <span>Sign out</span>
                </Link>
              </div>
            </div>
          </aside>
        </SheetContent>
      </Sheet>

      <Link href="/" className="flex items-center gap-2">
        <Image src="/logo.svg" alt="PrepWise" width={32} height={28} />
        <span className="text-primary-100 font-semibold">PrepWise</span>
      </Link>

      <div className="size-9" />
    </div>
  );
}
