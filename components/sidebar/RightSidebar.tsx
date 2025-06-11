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
            variant="ghost"
            size="icon"
            className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
            onClick={() => setMiniCalendarOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-cyan-500",
                miniCalendarOpen && "ring-2 ring-primary",
              )}
            >
              <Calendar className="h-6 w-6 text-white dark:text-white" />
            </div>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
            onClick={() => setBookmarkPanelOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-sky-500",
                bookmarkPanelOpen && "ring-2 ring-primary",
              )}
            >
              <Bookmark className="h-6 w-6 text-white dark:text-white" />
            </div>
          </Button>

          <WeatherSheet
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center bg-blue-500",
                  )}
                >
                  <Sun className="h-6 w-6 text-white dark:text-white" />
                </div>
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
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full p-0 w-12 h-12 flex items-center justify-center",
              countdownOpen && "ring-2 ring-primary"
            )}
            onClick={() => setCountdownOpen(true)}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-500">
              <CalendarClock className="h-6 w-6 text-white" />
            </div>
          </Button>

          <CountdownTool open={countdownOpen} onOpenChange={setCountdownOpen} />

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
            onClick={handleAnalyticsClick}
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-violet-500">
              <BarChart2 className="h-6 w-6 text-white dark:text-white" />
            </div>
          </Button>
          
          <AIChatSheet 
        open={chatOpen}
        onOpenChange={setChatOpen}
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 w-12 h-12 flex items-center justify-center"
            onClick={() => setChatOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-teal-500",
                chatOpen && "ring-2 ring-primary",
              )}
            >
              <MessageSquare className="h-6 w-6 text-white dark:text-white" />
            </div>
          </Button>
        }
        systemPrompt="你是日历应用的 AI 助手，目标是帮用户搞定日历、日程、时间相关的事儿，还要让交流像朋友聊天一样自然、好玩！用用户输入的语言回复，语气要贴着用户的风格（随意或正式都行）。你的主要任务是日历和时间管理，但可以顺着日程聊点相关的“彩蛋”，比如节日来历、城市历史或旅行小贴士。以下是你的规则：

核心任务：回答日历、日程、时间相关的问题，比如加事件、查日期、设提醒、时间换算、节假日信息等，尽量让答案实用又有趣。
节日相关：如果用户问到节日，告诉他们日期，还可以聊聊节日的来历或传统（保持简短，2-3 句话），让用户觉得有点“料”。比如：“2025年端午节是6月2日，纪念诗人屈原，大家会吃粽子、赛龙舟！要不要加个吃粽子的提醒？”
城市和旅行：如果用户提到旅行或城市（比如“我要去伦敦”），可以提供与日程相关的建议（最佳旅行时间、天气），还能简单介绍城市的历史或地标（3-4 句话，突出有趣点），但别写成旅游百科。比如：“伦敦秋天挺舒服，9-10月雨少，适合逛大本钟！它可是中世纪以来就热闹的贸易中心，还有神秘的伦敦塔传说。想定个行程吗？”
非相关问题：如果用户问了跟日历时间完全无关的事（比如“你喜欢啥电影”），就用幽默的方式拒绝，然后拉回日历或日程话题，比如：“嘿，我可是日历小能手，电影我不太行！😄 有啥行程、节日或旅行计划让我帮你安排不？”
语言适配：根据用户输入的语言（中文、英文、日文等）回复，语气尽量贴合用户的风格，像是跟朋友唠嗑。
输出格式：纯文本，不用 markdown，emoji 点缀一下就好，别太花哨，保持亲切感。
目标：让用户觉得你既靠谱又好玩，回答简洁但有料，像个能聊时间管理又懂点历史和旅行的小伙伴！
示例：

用户问：“后天是星期几？” 回复：“后天是星期五！有什么周末计划要我帮你记下来吗？”
用户问：“2025年中秋节啥时候？有啥特别的？” 回复：“2025年中秋节是9月10日，星期三！中秋是团圆节，古代人赏月写诗，现在大家吃月饼、看满月。想加个赏月日程吗？”
用户问：“我想去罗马旅游，咋样？” 回复：“罗马秋天超赞，10月凉爽又不挤，适合逛斗兽场！这座城市2000多年前就是罗马帝国的中心，街道上随便一块石头可能都有故事。定个旅行日期吗？”
用户问：“你会跳舞吗？” 回复：“哈哈，我是日历助手，舞步不太行，但能帮你安排时间跳舞！😉 有啥日程或旅行想法跟我说说？”
就是要让用户觉得跟你聊天既能解决问题，又有点小惊喜！"
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

