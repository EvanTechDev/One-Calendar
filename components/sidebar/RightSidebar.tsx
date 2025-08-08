import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { User, BookText, Plus, ArrowLeft, BarChart2, Edit2, Trash2, Calendar, Bookmark, MessageSquare, CalendarClock, Sun } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { translations, useLanguage } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import MiniCalendarSheet from "./MiniCalendarSheet"
import BookmarkPanel from "./BookmarkPanel"
import AIChatSheet from "./AIChat"
import { useRouter } from "next/navigation"
import { CountdownTool } from "./Countdown"
import WeatherSheet from './Weather';

// 通讯录类型定义
interface Contact {
  id: string
  name: string
  company?: string
  position?: string
  email?: string
  phone?: string
  address?: string
  birthday?: string
  notes?: string
  avatar?: string
  color: string
}

// 记事本类型定义
interface Note {
  id: string
  title: string
  content: string
  pinned?: boolean
  completed?: boolean
}

// 颜色选项
const colorOptions = [
  { value: "bg-blue-500", label: "Blue" },
  { value: "bg-green-500", label: "Green" },
  { value: "bg-purple-500", label: "Purple" },
  { value: "bg-yellow-500", label: "Yellow" },
  { value: "bg-red-500", label: "Red" },
  { value: "bg-pink-500", label: "Pink" },
  { value: "bg-indigo-500", label: "Indigo" },
  { value: "bg-orange-500", label: "Orange" },
  { value: "bg-teal-500", label: "Teal" },
]

// 联系人视图类型
type ContactView = "list" | "detail" | "edit"

interface RightSidebarProps {
  onViewChange?: (view: string) => void
  onEventClick: (event: any) => void
}

export default function RightSidebar({ onViewChange, onEventClick }: RightSidebarProps) {
  const [language] = useLanguage()
  const t = translations[language]

  // 状态管理
  const [contactsOpen, setContactsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [contactSearch, setContactSearch] = useState("")
  const [noteSearch, setNoteSearch] = useState("")
  const [chatOpen, setChatOpen] = useState(false)
  // Add a new state for the bookmark panel
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false)
  const [countdownOpen, setCountdownOpen] = useState(false);
  const router = useRouter();

  // 联系人视图状态
  const [contactView, setContactView] = useState<ContactView>("list")
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: "",
    company: "",
    position: "",
    email: "",
    phone: "",
    address: "",
    birthday: "",
    notes: "",
    color: "bg-blue-500", // 默认颜色
  })

  // 笔记编辑状态
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  useEffect(() => {
    // 从localStorage加载联系人数据
    const storedContacts = localStorage.getItem("contacts")
    if (storedContacts) {
      try {
        setContacts(JSON.parse(storedContacts))
      } catch (error) {
        console.error("Error parsing contacts from localStorage:", error)
      }
    }

    // 从localStorage加载笔记数据
    const storedNotes = localStorage.getItem("notes")
    if (storedNotes) {
      try {
        setNotes(JSON.parse(storedNotes))
      } catch (error) {
        console.error("Error parsing notes from localStorage:", error)
      }
    }
  }, [])

  // 添加新联系人
  const startAddContact = () => {
    setNewContact({
      name: "",
      company: "",
      position: "",
      email: "",
      phone: "",
      address: "",
      birthday: "",
      notes: "",
      color: "bg-blue-500", // 默认颜色
    })
    setContactView("edit")
    setSelectedContact(null)
  }

  // 编辑联系人
  const startEditContact = (contact: Contact) => {
    setSelectedContact(contact)
    setNewContact({ ...contact })
    setContactView("edit")
  }

  // 查看联系人详情
  const viewContactDetail = (contact: Contact) => {
    setSelectedContact(contact)
    setContactView("detail")
  }

  // 返回联系人列表
  const backToContactList = () => {
    setContactView("list")
    setSelectedContact(null)
  }

  // 保存联系人
  const saveContact = () => {
    if (!newContact.name || !newContact.color) return // 名称和颜色是必填项

    let updatedContacts = []

    if (selectedContact) {
      // 更新现有联系人
      updatedContacts = contacts.map((c) => (c.id === selectedContact.id ? ({ ...c, ...newContact } as Contact) : c))
    } else {
      // 添加新联系人
      const contact = {
        ...newContact,
        id: Date.now().toString(),
      } as Contact
      updatedContacts = [...contacts, contact]
    }

    // 更新状态和localStorage
    setContacts(updatedContacts)
    localStorage.setItem("contacts", JSON.stringify(updatedContacts))

    setContactView("list")
    setSelectedContact(null)
  }

    // 删除联系人
  const deleteContact = (id: string) => {
    const updatedContacts = contacts.filter((contact) => contact.id !== id)
    setContacts(updatedContacts)
    localStorage.setItem("contacts", JSON.stringify(updatedContacts))

    if (selectedContact?.id === id) {
      setSelectedContact(null)
      setContactView("list")
    }
  }

  // 添加新笔记
  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "",
      content: "",
    }
    const updatedNotes = [...notes, newNote]
    setNotes(updatedNotes)
    localStorage.setItem("notes", JSON.stringify(updatedNotes))
    setEditingNoteId(newNote.id)
  }

  // 更新笔记
  const updateNote = (id: string, data: Partial<Note>) => {
    const updatedNotes = notes.map((note) => (note.id === id ? { ...note, ...data } : note))
    setNotes(updatedNotes)
    localStorage.setItem("notes", JSON.stringify(updatedNotes))
  }

  // 删除笔记
  const deleteNote = (id: string) => {
    const updatedNotes = notes.filter((note) => note.id !== id)
    setNotes(updatedNotes)
    localStorage.setItem("notes", JSON.stringify(updatedNotes))

    if (editingNoteId === id) {
      setEditingNoteId(null)
    }
  } 

  // 处理分析按钮点击
  const handleAnalyticsClick = () => {
    if (onViewChange) {
      onViewChange("analytics")
    }
  }

  // 处理日期选择
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
  }

  // 渲染联系人列表视图
   const renderContactListView = () => (
    <>
      <SheetHeader className="p-4 border-b">
        <div className="flex items-center justify-between">
          <SheetTitle>{language === "zh" ? "通讯录" : "Contacts"}</SheetTitle>
        </div>
        <div className="mt-2">
          <Input
            placeholder={language === "zh" ? "搜索联系人..." : "Search contacts..."}
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
            className="w-full"
          />
        </div>
      </SheetHeader>

      <div className="p-4">
        <Button variant="outline" size="sm" onClick={startAddContact} className="w-full mb-4">
          <Plus className="mr-2 h-4 w-4" />
          {language === "zh" ? "添加联系人" : "Add Contact"}
        </Button>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "zh" ? "暂无联系人" : "No contacts yet"}
            </div>
          ) : (
            <div className="space-y-2">
              {contacts
                .filter(
                  (contact) =>
                    contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                    contact.email?.toLowerCase().includes(contactSearch.toLowerCase()),
                )
                .map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center p-2 hover:bg-accent rounded-md cursor-pointer"
                    onClick={() => viewContactDetail(contact)}
                  >
                    <Avatar className="h-10 w-10 mr-3">
                      {contact.avatar ? (
                        <AvatarImage src={contact.avatar} alt={contact.name} />
                      ) : (
                        <AvatarFallback className={contact.color}>
                          <span className="text-white">{contact.name.charAt(0).toUpperCase()}</span>
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <div className="font-medium">{contact.name}</div>
                      {contact.email && <div className="text-sm text-muted-foreground">{contact.email}</div>}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  )

  // 渲染联系人详情视图
  const renderContactDetailView = () => {
    if (!selectedContact) return null

    return (
      <>
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="mr-2" onClick={backToContactList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle>{language === "zh" ? "联系人详情" : "Contact Details"}</SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-4">
          <div className="flex items-center mb-6">
            <Avatar className="h-16 w-16 mr-4">
              {selectedContact.avatar ? (
                <AvatarImage src={selectedContact.avatar} alt={selectedContact.name} />
              ) : (
                <AvatarFallback className={selectedContact.color}>
                  <span className="text-white text-xl">{selectedContact.name.charAt(0).toUpperCase()}</span>
                </AvatarFallback>
              )}
            </Avatar>
            <div>
              <h2 className="text-xl font-bold">{selectedContact.name}</h2>
              {selectedContact.position && selectedContact.company && (
                <p className="text-sm text-muted-foreground">
                  {selectedContact.position} {language === "zh" ? "在" : "at"} {selectedContact.company}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {selectedContact.email && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {language === "zh" ? "电子邮件" : "Email"}
                </h3>
                <p>{selectedContact.email}</p>
              </div>
            )}

            {selectedContact.phone && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {language === "zh" ? "电话" : "Phone"}
                </h3>
                <p>{selectedContact.phone}</p>
              </div>
            )}

            {selectedContact.address && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {language === "zh" ? "地址" : "Address"}
                </h3>
                <p>{selectedContact.address}</p>
              </div>
            )}

            {selectedContact.birthday && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {language === "zh" ? "生日" : "Birthday"}
                </h3>
                <p>{selectedContact.birthday}</p>
              </div>
            )}

            {selectedContact.notes && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">
                  {language === "zh" ? "备注" : "Notes"}
                </h3>
                <p className="whitespace-pre-wrap">{selectedContact.notes}</p>
              </div>
            )}
          </div>

          <div className="flex space-x-2 mt-8">
            <Button variant="outline" className="flex-1" onClick={() => startEditContact(selectedContact)}>
              <Edit2 className="mr-2 h-4 w-4" />
              {language === "zh" ? "编辑" : "Edit"}
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteContact(selectedContact.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {language === "zh" ? "删除" : "Delete"}
            </Button>
          </div>
        </div>
      </>
    )
  }

  // 渲染联系人编辑视图
const renderContactEditView = () => (
    <div className="h-full flex flex-col">
      <SheetHeader className="p-4 border-b">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2"
            onClick={() => {
              if (selectedContact) {
                setContactView("detail")
              } else {
                setContactView("list")
              }
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <SheetTitle>
            {selectedContact
              ? language === "zh"
                ? "编辑联系人"
                : "Edit Contact"
              : language === "zh"
                ? "添加联系人"
                : "Add Contact"}
          </SheetTitle>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{language === "zh" ? "姓名" : "Name"}*</Label>
            <Input
              id="name"
              value={newContact.name || ""}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">{language === "zh" ? "颜色" : "Color"}*</Label>
            <Select value={newContact.color} onValueChange={(value) => setNewContact({ ...newContact, color: value })}>
              <SelectTrigger id="color">
                <SelectValue placeholder={language === "zh" ? "选择颜色" : "Select color"} />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <div className={cn("w-4 h-4 rounded-full mr-2", option.value)} />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">{language === "zh" ? "公司" : "Company"}</Label>
            <Input
              id="company"
              value={newContact.company || ""}
              onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="position">{language === "zh" ? "职位" : "Position"}</Label>
            <Input
              id="position"
              value={newContact.position || ""}
              onChange={(e) => setNewContact({ ...newContact, position: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{language === "zh" ? "电子邮件" : "Email"}</Label>
            <Input
              id="email"
              type="email"
              value={newContact.email || ""}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{language === "zh" ? "电话" : "Phone"}</Label>
            <Input
              id="phone"
              value={newContact.phone || ""}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{language === "zh" ? "地址" : "Address"}</Label>
            <Input
              id="address"
              value={newContact.address || ""}
              onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="birthday">{language === "zh" ? "生日" : "Birthday"}</Label>
            <Input
              id="birthday"
              type="date"
              value={newContact.birthday || ""}
              onChange={(e) => setNewContact({ ...newContact, birthday: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">{language === "zh" ? "备注" : "Notes"}</Label>
            <Textarea
              id="notes"
              value={newContact.notes || ""}
              onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="p-4 border-t flex justify-between">
        {selectedContact && (
          <Button variant="destructive" onClick={() => deleteContact(selectedContact.id)}>
            {language === "zh" ? "删除" : "Delete"}
          </Button>
        )}
        <div className="flex space-x-2 ml-auto">
          <Button
            variant="outline"
            onClick={() => {
              if (selectedContact) {
                setContactView("detail")
              } else {
                setContactView("list")
              }
            }}
          >
            {language === "zh" ? "取消" : "Cancel"}
          </Button>
          <Button onClick={saveContact} disabled={!newContact.name || !newContact.color}>
            {language === "zh" ? "保存" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* 右侧图标栏 - 固定在右侧 */}
      <div className="w-14 bg-background border-l flex flex-col items-center py-4 absolute right-0 top-16 bottom-0 z-30">
        <div className="flex flex-col items-center space-y-4 flex-1">
          {/* Mini Calendar Button */}
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={() => setMiniCalendarOpen(true)}
          >
            <Calendar className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={() => setBookmarkPanelOpen(true)}
          >
            <Bookmark className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <WeatherSheet
            trigger={
              <Button
                variant="secondary"
                size="icon"
                className="size-8"
              >
                <Sun className="h-6 w-6 text-black dark:text-white" />
              </Button>
            }
            />
                                     
          {/* <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
            onClick={() => setContactsOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-blue-500",
                contactsOpen && "ring-2 ring-primary",
              )}
            >
              <User className="h-6 w-6 text-white dark:text-white" />
            </div>
          </Button> */}

          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "size-8",
              countdownOpen && "ring-2 ring-primary"
            )}
            onClick={() => setCountdownOpen(true)}
          >
            <CalendarClock className="h-6 w-6 text-black" />
          </Button>

          <CountdownTool open={countdownOpen} onOpenChange={setCountdownOpen} />

          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={handleAnalyticsClick}
          >
            <BarChart2 className="h-6 w-6 text-black dark:text-white" />
          </Button>
          
          <AIChatSheet 
        open={chatOpen}
        onOpenChange={setChatOpen}
        trigger={
          <Button
            variant="secondary"
            size="icon"
            className="size-8"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare className="h-6 w-6 text-black dark:text-white" />
          </Button>
        }
        systemPrompt="# 日历应用 AI 助手提示词

## 角色定位
你是一个专业且友好的日历应用 AI 助手叫做 One AI，专门负责日历、日程和时间管理相关服务。你的交流风格自然亲切，如朋友般温暖，同时保持专业水准。

## 核心能力
- **日历管理**：创建、查询、修改日程事件
- **时间服务**：日期查询、时间换算、时区转换
- **节假日信息**：提供节日日期、来历和传统习俗
- **时间规划**：协助制定合理的时间安排和提醒设置

## 交互原则

### 1. 语言适配
- 使用用户输入的语言进行回复
- 匹配用户的语言风格（正式/随意）
- 保持一致的语气和用词习惯

### 2. 回复策略
- **主要任务**：专注日历、日程、时间管理问题
- **增值服务**：适当提供相关背景知识（节日文化、旅行建议等）
- **信息控制**：背景信息控制在 2-4 句话内，避免冗长
- **实用导向**：每次回复都尝试提供可执行的建议

### 3. 内容扩展规则

#### 节日相关
- 提供准确的节日日期
- 简述节日来历或传统（2-3 句）
- 主动询问是否需要设置相关提醒
- 示例：“2025年端午节是6月2日，纪念诗人屈原，传统上会吃粽子、赛龙舟。需要我帮你设置一个包粽子的提醒吗？”

#### 旅行城市
- 提供与时间相关的旅行建议（最佳时期、天气）
- 简介城市历史亮点（3-4 句，聚焦有趣元素）
- 引导用户进行行程规划
- 示例：“伦敦的9-10月天气宜人，雨量较少，正适合游览。这座城市自中世纪以来就是重要的贸易中心，大本钟和伦敦塔都承载着丰富的历史传说。要不要我帮你规划一下行程时间表？”

### 4. 边界管理
当用户询问非相关内容时：
- 用幽默友好的方式礼貌拒绝
- 快速转移话题回到核心功能
- 示例：“哈哈，我是专业的时间管家，这个问题可难倒我了！😊 不如聊聊你的日程安排？有什么重要事件需要我帮你记录吗？”

## 输出规范
- **格式**：纯文本，避免复杂的 markdown 格式
- **表情符号**：适度使用，增加亲和力但不过度
- **长度**：简洁明了，避免冗长回复
- **结构**：信息+背景+行动建议的模式

## 示例对话

**用户**：“明天是几号？”
**回复**：“明天是6月28日，星期六！有什么周末计划需要我帮你安排吗？”

**用户**：“2025年春节什么时候？”
**回复**：“2025年春节是1月29日，也就是农历正月初一！春节是中华文化最重要的传统节日，象征团圆和新的开始。要设置一些节日提醒吗，比如购买年货或安排家庭聚餐？”

**用户**：“我想去京都旅游”
**回复**：“京都春秋两季最美，4月樱花季和11月红叶季都很棒！这座千年古都曾是日本首都，保存着无数寺庙和传统建筑，每个季节都有独特的魅力。想确定一下具体的旅行日期吗？我可以帮你做个行程规划。”

## 目标效果
让用户感受到专业可靠的时间管理服务，同时在交流中获得愉悦的体验和有价值的知识增量。"
      />
        </div>
      </div>

      {/* 通讯录面板 - 使用Sheet组件 */}
      <Sheet
        open={contactsOpen}
        onOpenChange={(open) => {
          setContactsOpen(open)
          if (!open) {
            // 当关闭面板时，重置为列表视图
            setContactView("list")
          }
        }}
      >
        <SheetContent side="right" className="w-[350px] sm:w-[400px] p-0">
          {contactView === "list" && renderContactListView()}
          {contactView === "detail" && renderContactDetailView()}
          {contactView === "edit" && renderContactEditView()}
        </SheetContent>
      </Sheet>

      {/* 记事本面板 - 使用Sheet组件 */}
      <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
        <SheetContent side="right" className="w-[350px] sm:w-[400px] p-0">
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle>{language === "zh" ? "记事" : "Notes"}</SheetTitle>
            </div>
            <div className="mt-2">
              <Input
                placeholder={language === "zh" ? "搜索记事..." : "Search notes..."}
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full"
              />
            </div>
          </SheetHeader>

          <div className="p-4">
            <Button variant="outline" size="sm" onClick={addNote} className="w-full mb-4">
              <Plus className="mr-2 h-4 w-4" />
              {language === "zh" ? "添加记事..." : "Add Note..."}
            </Button>

            <ScrollArea className="h-[calc(100vh-200px)]">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "zh" ? "暂无记事" : "No notes yet"}
                </div>
              ) : (
                <div className="space-y-3">
                  {notes
                    .filter(
                      (note) =>
                        note.title.toLowerCase().includes(noteSearch.toLowerCase()) ||
                        note.content.toLowerCase().includes(noteSearch.toLowerCase()),
                    )
                    .map((note) => (
                      <div
                        key={note.id}
                        className="p-3 border rounded-md hover:shadow-sm"
                        onClick={() => setEditingNoteId(note.id)}
                      >
                        <div className="flex justify-between items-start">
                          {editingNoteId === note.id ? (
                            <div className="w-full">
                              <Input
                                value={note.title}
                                onChange={(e) => updateNote(note.id, { title: e.target.value })}
                                placeholder={language === "zh" ? "标题" : "Title"}
                                className="mb-2 w-full"
                                autoFocus
                              />
                              <Textarea
                                value={note.content}
                                onChange={(e) => updateNote(note.id, { content: e.target.value })}
                                placeholder={language === "zh" ? "内容" : "Content"}
                                className="min-h-[100px] w-full"
                              />
                              <div className="flex justify-between mt-2">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNote(note.id)
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {language === "zh" ? "删除" : "Delete"}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingNoteId(null)
                                  }}
                                >
                                  {language === "zh" ? "完成" : "Done"}
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full">
                              <div className="font-medium">
                                {note.title || (language === "zh" ? "无标题" : "Untitled")}
                              </div>
                              <div className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                                {note.content || (language === "zh" ? "无内容" : "No content")}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mini Calendar Sheet */}
      <MiniCalendarSheet
        open={miniCalendarOpen}
        onOpenChange={setMiniCalendarOpen}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />
      {/* Add the BookmarkPanel component at the end of the return statement, before the closing fragment */}
      <BookmarkPanel open={bookmarkPanelOpen} onOpenChange={setBookmarkPanelOpen} />
    </>
  )
}

