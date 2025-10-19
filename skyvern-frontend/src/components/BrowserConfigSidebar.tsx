import { useState, useEffect } from 'react';
import { useSidebarStore } from "@/store/SidebarStore";
import { Button } from "./ui/button";
import { ChromeIcon, SettingsIcon } from "./icons/BrowserIcons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { BrowserSelector } from "./BrowserSelector";
import { Control } from 'react-hook-form';

interface BrowserConfigSidebarProps {
  control: Control<any>;
  name?: string;
}

export function BrowserConfigSidebar({ control, name = "browser_config" }: BrowserConfigSidebarProps) {
  try {
    // 主要的组件逻辑将放在这里
    return <BrowserConfigSidebarContent control={control} name={name} />;
  } catch (error) {
    console.error('BrowserConfigSidebar error:', error);
    return (
      <div className="text-red-500 text-xs p-2 bg-red-50 rounded border border-red-200">
        Browser configuration unavailable
      </div>
    );
  }
}

function BrowserConfigSidebarContent({ control, name = "browser_config" }: BrowserConfigSidebarProps) {
  const { collapsed } = useSidebarStore();
  const [isOpen, setIsOpen] = useState(false);

  // 当侧边栏折叠状态改变时，关闭 Popover
  useEffect(() => {
    setIsOpen(false);
  }, [collapsed]);

  // 组件卸载时清理 Popover 状态
  useEffect(() => {
    return () => {
      setIsOpen(false);
    };
  }, []);

  // 错误边界处理 - 由于hasError不存在，暂时注释掉
  // if (hasError) {
  //   return (
  //     <div className="text-red-500 text-xs p-2 bg-red-50 rounded border border-red-200">
  //       Browser configuration unavailable
  //     </div>
  //   );
  // }

  const getBrowserIcon = () => {
    return <ChromeIcon className="h-4 w-4" />;
  };

  const getBrowserLabel = () => {
    if (collapsed) {
      return "Browser";
    }
    return "Browser Config";
  };

  if (collapsed) {
    return (
      <Popover
        open={isOpen}
        onOpenChange={setIsOpen}
        modal={false}  // 使用非模态模式避免DOM冲突
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="w-full justify-center"
            title="Browser Configuration"
          >
            {getBrowserIcon()}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-80"
          align="start"
          side="right"
          sideOffset={8}
          onPointerDownOutside={() => setIsOpen(false)}  // 点击外部时关闭
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ChromeIcon className="h-5 w-5" />
              <h3 className="font-semibold">Browser Configuration</h3>
            </div>
            <BrowserSelector control={control} name={name} />
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getBrowserIcon()}
          <span className="text-sm font-medium">{getBrowserLabel()}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-6 w-6"
        >
          <SettingsIcon className="h-3 w-3" />
        </Button>
      </div>

      {isOpen && (
        <div className="rounded-lg border bg-card p-3">
          <BrowserSelector control={control} name={name} />
        </div>
      )}
    </div>
  );
}