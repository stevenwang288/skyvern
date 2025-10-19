import { Sidebar } from "@/routes/root/Sidebar";
import { Header } from "@/routes/root/Header";
import { Toaster } from "@/components/ui/toaster";
import { useSidebarStore } from "@/store/SidebarStore";
import { cn } from "@/util/utils";
import { Control } from 'react-hook-form';
import { ReactNode } from 'react';

type TaskCreateLayoutProps = {
  formControl?: Control<any>;
  children: ReactNode;
};

function TaskCreateLayout({ formControl, children }: TaskCreateLayoutProps) {
  const collapsed = useSidebarStore((state) => state.collapsed);
  const embed = new URLSearchParams(window.location.search).get("embed");
  const isEmbedded = embed === "true";

  const horizontalPadding = cn("lg:pl-64", {
    "lg:pl-28": collapsed,
    "lg:pl-4": isEmbedded,
  });

  return (
    <>
      {!isEmbedded && <Sidebar formControl={formControl} />}
      <div className="h-full w-full">
        <div className={horizontalPadding}>
          {/* 可以在这里添加API密钥横幅等 */}
        </div>
        <Header />
        <main
          className={cn("lg:pb-4", horizontalPadding)}
        >
          {children}
        </main>
      </div>
      <Toaster />
    </>
  );
}

export { TaskCreateLayout };