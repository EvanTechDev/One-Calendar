'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { useLocalStorage } from '@/lib/use-local-storage'
import { Calendar } from 'lucide-react'

interface CountdownItem {
  id: string
  title: string
  date: string // yyyy-MM-dd
}

const mockCountdowns: CountdownItem[] = [
  { id: '1', title: '考试日', date: '2025-06-20' },
  { id: '2', title: '旅行计划', date: '2025-07-15' },
  { id: '3', title: '朋友生日', date: '2025-08-01' },
]

export default function CountdownPage() {
  const [countdowns, setCountdowns] = useState<CountdownItem[]>(mockCountdowns)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CountdownItem | null>(null)
  const [open, setOpen] = useState(false)
  const [hasShownToastToday, setHasShownToastToday] = useLocalStorage('today-toast', false)

  useEffect(() => {
    const today = new Date().toDateString()
    const lastShown = localStorage.getItem('today-toast-date')
    if (!hasShownToastToday || lastShown !== today) {
      toast('🎉 新的一天，加油！')
      setHasShownToastToday(true)
      localStorage.setItem('today-toast-date', today)
    }
  }, [hasShownToastToday, setHasShownToastToday])

  const filtered = countdowns.filter(item =>
    item.title.toLowerCase().includes(search.toLowerCase())
  )

  const handleClick = (item: CountdownItem) => {
    setSelected(item)
    setOpen(true)
  }

  const handleDelete = (id: string) => {
    setCountdowns(prev => prev.filter(item => item.id !== id))
    setOpen(false)
    toast('已删除倒数日')
  }

  const handleEdit = (id: string) => {
    // TODO: 添加编辑逻辑
    toast('编辑功能尚未实现')
  }

  const daysLeft = (date: string) => {
    const now = new Date()
    const target = new Date(date)
    return differenceInDays(target, now)
  }

  return (
    <div className="p-4 space-y-4">
      <Input
        placeholder="搜索倒数日"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full"
      />

      <div className="grid gap-3">
        {filtered.map(item => (
          <Card key={item.id} onClick={() => handleClick(item)} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <div className="text-lg font-semibold flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted-foreground" /> {item.title}
                </div>
                <div className="text-sm text-muted-foreground">{item.date}</div>
              </div>
              <div className="text-xl font-bold text-blue-600">
                {daysLeft(item.date)} 天
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>{selected?.title}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {selected && (
              <>
                <div className="text-center text-6xl font-bold text-blue-600">
                  {daysLeft(selected.date)} 天
                </div>
                <div className="text-center text-muted-foreground text-sm">
                  {format(new Date(selected.date), 'yyyy-MM-dd')}
                </div>
                <div className="flex justify-around mt-6">
                  <Button variant="outline" onClick={() => handleEdit(selected.id)}>编辑</Button>
                  <Button variant="destructive" onClick={() => handleDelete(selected.id)}>
                    删除
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
