import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { SavedView } from "@shared/schema";

export type FilterState = {
  status: string;
  carrier: string;
  origin: string;
  searchQuery: string;
  quickFilter: string | null;
};

type SavedViewsMenuProps = {
  currentFilters: FilterState;
  onLoadView: (filters: FilterState) => void;
};

export function SavedViewsMenu({ currentFilters, onLoadView }: SavedViewsMenuProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const { toast } = useToast();

  const { data: savedViews = [] } = useQuery<SavedView[]>({
    queryKey: ["/api/saved-views"],
  });

  const createViewMutation = useMutation({
    mutationFn: async (data: { name: string; filters: FilterState }) => {
      return await apiRequest("POST", "/api/saved-views", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views"] });
      toast({
        title: "View saved",
        description: "Your filter view has been saved successfully.",
      });
      setSaveDialogOpen(false);
      setViewName("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save view. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteViewMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/saved-views/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saved-views"] });
      toast({
        title: "View deleted",
        description: "The saved view has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete view. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSaveView = () => {
    if (!viewName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this view.",
        variant: "destructive",
      });
      return;
    }

    createViewMutation.mutate({
      name: viewName.trim(),
      filters: currentFilters,
    });
  };

  const handleLoadView = (view: SavedView) => {
    onLoadView(view.filters as FilterState);
    toast({
      title: "View loaded",
      description: `Loaded "${view.name}" filter view.`,
    });
  };

  const handleDeleteView = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this saved view?")) {
      deleteViewMutation.mutate(id);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="default"
          onClick={() => setSaveDialogOpen(true)}
          data-testid="button-save-view"
        >
          <Save className="h-4 w-4 mr-2" />
          Save View
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="default" data-testid="button-load-view">
              <FolderOpen className="h-4 w-4 mr-2" />
              Load View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {savedViews.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                No saved views yet
              </div>
            ) : (
              savedViews.map((view) => (
                <DropdownMenuItem
                  key={view.id}
                  onClick={() => handleLoadView(view)}
                  className="flex items-center justify-between cursor-pointer"
                  data-testid={`menu-item-view-${view.id}`}
                >
                  <span>{view.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleDeleteView(e, view.id)}
                    data-testid={`button-delete-view-${view.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent data-testid="dialog-save-view">
          <DialogHeader>
            <DialogTitle>Save Filter View</DialogTitle>
            <DialogDescription>
              Give this filter configuration a name so you can quickly load it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View Name</Label>
              <Input
                id="view-name"
                placeholder="e.g., High Priority Shipments"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveView();
                  }
                }}
                data-testid="input-view-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Current Filters</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                {currentFilters.status !== "all" && (
                  <div>Status: {currentFilters.status}</div>
                )}
                {currentFilters.carrier !== "all" && (
                  <div>Carrier: {currentFilters.carrier}</div>
                )}
                {currentFilters.origin !== "all" && (
                  <div>Origin: {currentFilters.origin}</div>
                )}
                {currentFilters.searchQuery && (
                  <div>Search: "{currentFilters.searchQuery}"</div>
                )}
                {currentFilters.quickFilter && (
                  <div className="font-medium text-foreground">Quick Filter: {currentFilters.quickFilter}</div>
                )}
                {currentFilters.status === "all" &&
                  currentFilters.carrier === "all" &&
                  currentFilters.origin === "all" &&
                  !currentFilters.searchQuery &&
                  !currentFilters.quickFilter && (
                    <div className="italic text-yellow-600 dark:text-yellow-500">⚠️ No filters applied - this will save all containers</div>
                  )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              data-testid="button-cancel-save"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveView}
              disabled={createViewMutation.isPending}
              data-testid="button-confirm-save"
            >
              {createViewMutation.isPending ? "Saving..." : "Save View"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
