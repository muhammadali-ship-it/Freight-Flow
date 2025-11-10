import { Home, Package, BarChart3, Settings, Plug, Users, LogOut, Upload, Webhook, Boxes, Activity, RefreshCw } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Separator } from "@/components/ui/separator";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
    roles: ["User", "Manager", "Admin"],
  },
  {
    title: "Active Shipments",
    url: "/shipments",
    icon: Package,
    roles: ["User", "Manager", "Admin"],
  },
  {
    title: "Cost Analytics",
    url: "/analytics",
    icon: BarChart3,
    roles: ["Manager", "Admin"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["Manager", "Admin"],
  },
];

const integrationItems = [
  {
    title: "Webhook Monitor",
    url: "/webhook-monitor",
    icon: Webhook,
    roles: ["Manager", "Admin"],
  },
  {
    title: "CF Update Tracking",
    url: "/cargoes-flow/update-logs",
    icon: RefreshCw,
    roles: ["Manager", "Admin"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const userRole = user?.role || "User";
  const visibleMenuItems = menuItems.filter(item => item.roles.includes(userRole));
  const visibleIntegrationItems = integrationItems.filter(item => item.roles.includes(userRole));

  return (
    <Sidebar>
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">FreightTrack</span>
            <span className="text-xs text-muted-foreground">{user?.name || 'Operations'}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {visibleIntegrationItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Integrations</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleIntegrationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <a href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>{logoutMutation.isPending ? "Logging out..." : "Logout"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
