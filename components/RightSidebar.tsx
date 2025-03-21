"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { User, BookText, Plus, Trash, ArrowLeft } from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { translations, useLanguage } from "@/lib/i18n"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

export default function RightSidebar() {
  const [language] = useLanguage()
  const t = translations[language]

  // 状态管理
  const [contactsOpen, setContactsOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [contactSearch, setContactSearch] = useState("")
  const [noteSearch, setNoteSearch] = useState("")

  // 联系人编辑状态
  const [addingContact, setAddingContact] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
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
    setAddingContact(true)
  }

  // 编辑联系人
  const startEditContact = (contact: Contact) => {
    setEditingContact(contact)
    setNewContact({ ...contact })
  }

  // 保存联系人
  const saveContact = () => {
    if (!newContact.name || !newContact.color) return // 名称和颜色是必填项

    if (editingContact) {
      // 更新现有联系人
      setContacts(contacts.map((c) => (c.id === editingContact.id ? ({ ...c, ...newContact } as Contact) : c)))
      setEditingContact(null)
    } else {
      // 添加新联系人
      const contact = {
        ...newContact,
        id: Date.now().toString(),
      } as Contact
      setContacts([...contacts, contact])
    }
    setAddingContact(false)
  }

  // 删除联系人
  const deleteContact = (id: string) => {
    setContacts(contacts.filter((contact) => contact.id !== id))
    if (editingContact?.id === id) {
      setEditingContact(null)
      setAddingContact(false)
    }
  }

  // 添加新笔记
  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "",
      content: "",
    }
    setNotes([...notes, newNote])
    setEditingNoteId(newNote.id)
  }

  // 更新笔记
  const updateNote = (id: string, data: Partial<Note>) => {
    setNotes(notes.map((note) => (note.id === id ? { ...note, ...data } : note)))
  }

  // 删除笔记
  const deleteNote = (id: string) => {
    setNotes(notes.filter((note) => note.id !== id))
    if (editingNoteId === id) {
      setEditingNoteId(null)
    }
  }

  return (
    <>
      {/* 右侧图标栏 - 固定在右侧 */}
      <div className="w-14 bg-background border-l flex flex-col items-center py-4">
        <div className="flex flex-col items-center space-y-8 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 hover:bg-accent w-12 h-12 flex items-center justify-center"
            onClick={() => setContactsOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-blue-500",
                contactsOpen && "ring-2 ring-primary",
              )}
            >
              <User className="h-5 w-5 text-primary-foreground" />
            </div>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full p-0 hover:bg-accent w-12 h-12 flex items-center justify-center"
            onClick={() => setNotesOpen(true)}
          >
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center bg-yellow-400",
                notesOpen && "ring-2 ring-primary",
              )}
            >
              <BookText className="h-5 w-5 text-primary-foreground" />
            </div>
          </Button>
        </div>
      </div>

      {/* 通讯录面板 - 使用Sheet组件 */}
      <Sheet open={contactsOpen} onOpenChange={setContactsOpen}>
        <SheetContent side="right" className="w-[350px] sm:w-[400px] p-0">
          {addingContact || editingContact ? (
            // 添加/编辑联系人表单
            <div className="h-full flex flex-col">
              <SheetHeader className="p-4 border-b">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-2"
                    onClick={() => {
                      setAddingContact(false)
                      setEditingContact(null)
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <SheetTitle>
                    {editingContact
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
                    <Select
                      value={newContact.color}
                      onValueChange={(value) => setNewContact({ ...newContact, color: value })}
                    >
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
                {editingContact && (
                  <Button variant="destructive" onClick={() => deleteContact(editingContact.id)}>
                    {language === "zh" ? "删除" : "Delete"}
                  </Button>
                )}
                <div className="flex space-x-2 ml-auto">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setAddingContact(false)
                      setEditingContact(null)
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
          ) : (
            // 联系人列表视图
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
                            onClick={() => startEditContact(contact)}
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
          )}
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
                                  <Trash className="mr-2 h-4 w-4" />
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
    </>
  )
}

