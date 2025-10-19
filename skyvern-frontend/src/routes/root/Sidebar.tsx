import { useSidebarStore } from "@/store/SidebarStore";
import { cn } from "@/util/utils";
import { SidebarContent } from "./SidebarContent";
import { Control } from 'react-hook-form';

type SidebarProps = {
  formControl?: Control<any>;
};

function Sidebar({ formControl }: SidebarProps) {
  const collapsed = useSidebarStore((state) => state.collapsed);

  return (
    <aside
      className={cn(
        "fixed hidden h-screen min-h-screen border-r-2 px-6 lg:block",
        {
          "w-64": !collapsed,
          "w-28": collapsed,
        },
      )}
    >
      <SidebarContent useCollapsedState formControl={formControl} />
    </aside>
  );
}

export { Sidebar };
