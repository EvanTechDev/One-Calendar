import {
  User,
  BookText,
  Plus,
  ArrowLeft,
  Edit2,
  Trash2,
  Calendar,
  Bookmark,
  MessageSquare,
  Sun,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ClockDashed } from "@/components/icons/clock-dashed";
import { ScrollArea } from "@/components/ui/scroll-area";
import MiniCalendarSheet from "./mini-calendar-sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BookmarkPanel from "./bookmark-panel";
import { useRouter } from "next/navigation";
import { CountdownTool } from "./countdown";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
];

interface RightSidebarProps {
  onViewChange?: (view: string) => void;
  onEventClick: (event: any) => void;
}

export default function RightSidebar({
  onViewChange,
  onEventClick,
}: RightSidebarProps) {
  const [miniCalendarOpen, setMiniCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookmarkPanelOpen, setBookmarkPanelOpen] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const router = useRouter();

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <>
      <div className="w-14 bg-background border-l flex flex-col items-center py-4 absolute right-0 top-16 bottom-0 z-30">
        <div className="flex flex-col items-center space-y-6 flex-1">
          {}
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full size-10"
            onClick={() => setMiniCalendarOpen(true)}
          >
            <Calendar className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className="rounded-full size-10"
            onClick={() => setBookmarkPanelOpen(true)}
          >
            <Bookmark className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "rounded-full size-10",
              countdownOpen && "ring-2 ring-primary",
            )}
            onClick={() => setCountdownOpen(true)}
          >
            <ClockDashed className="h-6 w-6 text-black dark:text-white" />
          </Button>

          <CountdownTool open={countdownOpen} onOpenChange={setCountdownOpen} />
        </div>
      </div>

      {}
      <MiniCalendarSheet
        open={miniCalendarOpen}
        onOpenChange={setMiniCalendarOpen}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />

      <BookmarkPanel
        open={bookmarkPanelOpen}
        onOpenChange={setBookmarkPanelOpen}
      />
    </>
  );
}
