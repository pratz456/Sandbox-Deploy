"use client";

import React from 'react';
import { LogoutButton } from './logout-button';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { Home, CreditCard, BarChart3, Settings, FolderOpen, HelpCircle, Shield, Info } from 'lucide-react';
interface SidebarNavProps {
  user: { id: string; email?: string; user_metadata?: { name?: string } };
  userProfile?: { name?: string; email?: string };
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ user, userProfile }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();



  const navItems = [
    {
      name: 'Home',
      href: '/protected',
      icon: Home,
      description: 'Dashboard overview',
      isHome: true
    },
    {
      name: 'Transactions',
      href: '/protected/transactions',
      icon: CreditCard,
      description: 'View and manage transactions'
    },
    {
      name: 'Categories',
      href: '/protected?screen=categories',
      icon: FolderOpen,
      description: 'Manage expense categories'
    },
    {
      name: 'Reports',
      href: '/protected/reports',
      icon: BarChart3,
      description: 'Tax reports and analytics'
    },
    {
      name: 'Settings',
      href: '/protected/settings',
      icon: Settings,
      description: 'Account and preferences'
    },
    {
      name: 'Help',
      href: '/protected/help',
      icon: HelpCircle,
      description: 'Help and support'
    },
    {
      name: 'Privacy',
      href: '/protected/privacy',
      icon: Shield,
      description: 'Privacy policy'
    },
    {
      name: 'About',
      href: '/protected/about',
      icon: Info,
      description: 'About WriteOff'
    }
  ];

  const isActive = (href: string) => {
    if (href === '/protected') {
      // Home should only be active when exactly on /protected with no query params
      return pathname === '/protected' && !searchParams.has('screen');
    }

    // For Categories, check if we're on the categories screen
    if (href === '/protected?screen=categories') {
      return pathname === '/protected' && searchParams.get('screen') === 'categories';
    }

    // For Settings, check if we're on the settings page
    if (href === '/protected/settings') {
      return pathname === '/protected/settings';
    }

    // For other pages, check if the pathname starts with the href
    return pathname.startsWith(href);
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col justify-between">
      {/* Logo/Brand */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <img src="/writeofflogo.png" alt="WriteOff" className="w-7 h-7 rounded-lg" />
          <div>
            <h1 className="text-base font-bold text-gray-900">WriteOff</h1>
            <p className="text-xs text-gray-500">Effortless Tax</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          // Special handling for Home button to ensure proper navigation
          if (item.isHome) {
            return (
              <button
                key={item.name}
                onClick={() => {
                  console.log('🏠 Home button clicked, navigating to /protected');
                  router.push('/protected');
                }}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group w-full text-left ${active
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon
                  className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                    }`}
                />
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className={`text-xs ${active ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                    {item.description}
                  </div>
                </div>
              </button>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group ${active
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon
                className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                  }`}
              />
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className={`text-xs ${active ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                  {item.description}
                </div>
              </div>
            </Link>
          );
        })}

      </nav>

      {/* User Info */}
      <div className="p-3 border-t border-gray-200 flex flex-col items-center">
        <div className="flex items-center gap-2 w-full mb-2">
          <div className="w-7 h-7 bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-gray-600 font-medium text-xs">
              {userProfile?.name?.charAt(0) || user.user_metadata?.name?.charAt(0) || user.email?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-900 truncate">
              {userProfile?.name || user.user_metadata?.name || 'User'}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {userProfile?.email || user.email}
            </p>
          </div>
        </div>
      </div>
      {/* Sign Out at bottom */}
      <div className="p-3 border-t border-gray-200">
        <LogoutButton className="w-full border border-red-200 text-red-600 bg-white hover:bg-red-50 hover:text-red-700 font-semibold py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-2" icon />
      </div>
    </div>
  );
};
