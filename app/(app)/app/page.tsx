import Calendar from "@/components/Calendar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Home() {
  const isMobile = useIsMobile();
  const language = navigator.language;

  return (
    <div>
      {isMobile ? (
        <div>
          {language.startsWith("zh") ? (
            <p>请使用电脑打开此页面</p>
          ) : (
            <p>Please open this page on a computer</p>
          )}
        </div>
      ) : (
        <Calendar />
      )}
    </div>
  );
}
