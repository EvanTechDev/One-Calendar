'use client'

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { PanelLeft } from 'lucide-react'
import Sidebar from '../sidebar'
import { type ComponentProps } from 'react'

export function MobileSidebar(props: ComponentProps<typeof Sidebar>) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="md:hidden mr-2">
          <PanelLeft />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-[247px] max-w-[247px] p-0 sm:max-w-[247px]"
      >
        <Sidebar
          {...props}
          className="!w-[247px] max-w-[247px] border-r-0"
          hideCreateButton
        />
      </SheetContent>
    </Sheet>
  )
}
