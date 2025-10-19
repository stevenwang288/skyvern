import { CompassIcon } from "@/components/icons/CompassIcon";
import { NavLinkGroup } from "@/components/NavLinkGroup";
import { useSidebarStore } from "@/store/SidebarStore";
import { cn } from "@/util/utils";
import {
  CounterClockwiseClockIcon,
  GearIcon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";
import { KeyIcon } from "@/components/icons/KeyIcon.tsx";
import { BrowserConfigSidebar } from "@/components/BrowserConfigSidebar";
import { Control } from 'react-hook-form';

interface SideNavProps {
  formControl?: Control<any>;
}

function SideNav({ formControl }: SideNavProps) {
  const { collapsed } = useSidebarStore();

  return (
    <nav
      className={cn("space-y-5", {
        "items-center": collapsed,
      })}
    >
      <NavLinkGroup
        title="Build"
        links={[
          {
            label: "Discover",
            to: "/discover",
            icon: <CompassIcon className="size-6" />,
          },
          {
            label: "Workflows",
            to: "/workflows",
            icon: <LightningBoltIcon className="size-6" />,
          },
          {
            label: "History",
            to: "/history",
            icon: <CounterClockwiseClockIcon className="size-6" />,
          },
        ]}
      />

      {formControl && (
        <div className="space-y-2" key={`browser-config-${collapsed}`}>
          <BrowserConfigSidebar control={formControl} />
        </div>
      )}

      <NavLinkGroup
        title={"General"}
        links={[
          {
            label: "Settings",
            to: "/settings",
            icon: <GearIcon className="size-6" />,
          },
          {
            label: "Credentials",
            to: "/credentials",
            icon: <KeyIcon className="size-6" />,
          },
        ]}
      />
    </nav>
  );
}

export { SideNav };
