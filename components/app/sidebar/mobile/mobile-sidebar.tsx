'use client'

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { PanelLeft } from 'lucide-react'
import Sidebar from '../sidebar'
import { type ComponentProps } from 'react'

export function MobileSidebar({
  children,
  ...props
}: { children: React.ReactNode } & ComponentProps<typeof Sidebar>) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden mr-2">
          <PanelLeft />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0 w-[280px]">
        <Sidebar {...props} className="!w-full" />
      </SheetContent>
    </Sheet>
  )
}
