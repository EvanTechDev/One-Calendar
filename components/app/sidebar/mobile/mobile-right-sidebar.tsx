'use client'

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { MoreVertical } from 'lucide-react'
import RightSidebar from '../right-sidebar'
import { type ComponentProps } from 'react'

export function MobileRightSidebar(props: ComponentProps<typeof RightSidebar>) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden size-8 rounded-full"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="p-0 w-[280px]">
        <div className="h-full pt-10">
          <RightSidebar {...props} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
