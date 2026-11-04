'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Sliders,
  TrendingUp,
  History,
  Settings,
  Thermometer,
  Zap,
  Menu,
  X,
  Radio,
  Cpu,
  Sparkles
} from 'lucide-react';
import { SystemStatusState } from '@/types/greenhouse';

interface NavbarProps {
  systemStatus: SystemStatusState;
  demoMode: boolean;
  onToggleDemoMode: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  systemStatus,
  demoMode,
  onToggleDemoMode,
}) => {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { name: 'Dashboard', href: '/dashboard', icon: Activity },
    { name: 'Predictions', href: '/predictions', icon: TrendingUp },
    { name: 'Control', href: '/control', icon: Sliders },
    { name: 'Sensors', href: '/sensors', icon: Thermometer },
    { name: 'History', href: '/history', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const isOnline = systemStatus.esp8266 === 'online';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-all duration-300 shadow-2xs">
      <div className="mx-auto flex h-[72px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        
        {/* 1. Futuristic Brand Logo */}
        <Link 
          href="/dashboard" 
          className="group flex shrink-0 items-center gap-3 transition-transform duration-200 hover:scale-[1.02]" 
          aria-label="AGROVYN dashboard"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-500 text-white shadow-md shadow-emerald-600/20 ring-4 ring-emerald-50 group-hover:shadow-emerald-600/35 transition-all">
            <Zap className="h-5 w-5 transition-transform duration-300 group-hover:rotate-12" strokeWidth={2.2} />
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-cyan-400 ring-2 ring-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-[0.2em] text-slate-900 text-base">AGROVYN</span>
              <span className="rounded bg-emerald-100/90 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-widest text-emerald-800">
                AI 2.0
              </span>
            </div>
            <p className="text-[10px] font-mono font-medium tracking-wider text-slate-400 uppercase">
              Adaptive Microclimate
            </p>
          </div>
        </Link>

        {/* 2. Innovative Floating Navigation Links */}
        <nav 
          className="hidden h-11 items-center gap-1 rounded-2xl border border-slate-200/70 bg-slate-100/70 p-1 backdrop-blur-sm lg:flex shadow-inner" 
          aria-label="Main navigation"
        >
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-slate-200/80 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Icon 
                  aria-hidden="true" 
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                    isActive ? 'text-emerald-600 scale-110' : 'text-slate-400 group-hover:text-slate-700'
                  }`} 
                  strokeWidth={isActive ? 2.2 : 1.8} 
                />
                <span>{link.name}</span>
                {isActive && (
                  <span className="absolute bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-emerald-600" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* 3. Telemetry Beacon & Controls */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          
          {/* Hardware Beacon Capsule */}
          <div 
            className={`hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all sm:flex ${
              isOnline
                ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-900 shadow-2xs'
                : 'border-rose-200/80 bg-rose-50/70 text-rose-900'
            }`}
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              {isOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            </span>
            <span className="font-mono text-[11px] font-semibold">
              {isOnline ? 'ESP8266 Live' : 'Hardware Offline'}
            </span>
          </div>

          {/* Futuristic Data Mode Switcher */}
          <button
            type="button"
            onClick={() => onToggleDemoMode(!demoMode)}
            aria-label={`Switch to ${demoMode ? 'live' : 'demo'} data`}
            className={`group relative inline-flex h-9 items-center gap-1.5 overflow-hidden rounded-xl px-3 text-xs font-bold transition-all duration-300 shadow-sm active:scale-95 ${
              demoMode
                ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-amber-200/50'
                : 'border border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-500'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${demoMode ? 'bg-amber-500' : 'bg-cyan-300 animate-pulse'}`} />
            <span>{demoMode ? 'Simulation Mode' : 'Real Hardware'}</span>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-main-navigation"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Animated Dropdown */}
      {mobileOpen && (
        <nav 
          id="mobile-main-navigation" 
          className="animate-in fade-in slide-in-from-top-2 duration-200 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3 lg:hidden shadow-lg" 
          aria-label="Main navigation"
        >
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {isOnline ? 'ESP8266 Connected' : 'Disconnected'}
            </span>
            <span className="font-mono text-[10px] text-slate-400">NodeMCU + ADS1015</span>
          </div>
        </nav>
      )}
    </header>
  );
};
