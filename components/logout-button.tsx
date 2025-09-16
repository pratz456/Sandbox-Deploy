"use client";

import { useAuth } from "@/lib/firebase/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton({ className = "", icon = false, ...props }) {
  const { signOut } = useAuth();
  const router = useRouter();

  const logout = async () => {
    await signOut();
    router.push("/auth/login");
  };

  return (
    <Button onClick={logout} className={className} {...props}>
      {icon && <LogOut className="w-5 h-5 mr-1" />}
      Sign Out
    </Button>
  );
}
