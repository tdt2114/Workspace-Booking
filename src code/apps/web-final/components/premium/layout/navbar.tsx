"use client"

import * as React from "react"
import { Bell, User, Search } from "lucide-react"
import { Button } from "@/components/premium/ui/button"
import { Input } from "@/components/premium/ui/input"

export function Navbar() {
  return (
    <header className="h-16 flex items-center justify-between px-8 glass-panel border-b border-white/5 z-10">
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <Input 
          placeholder="Search for desks, colleagues..." 
          className="pl-10 bg-white/5 border-white/10 focus-visible:ring-primary-500/50"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-primary-500 rounded-full border-2 border-background" />
        </Button>
        
        <div className="h-8 w-[1px] bg-white/10 mx-2" />

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold text-white">Admin Demo</span>
            <span className="text-xs text-slate-500">Administrator</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center text-primary-500">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  )
}
