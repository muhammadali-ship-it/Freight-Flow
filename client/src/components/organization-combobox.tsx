import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Organization {
  id: string;
  name: string;
  type: string;
  address?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface OrganizationComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  type: "shipper" | "consignee";
  placeholder?: string;
}

export function OrganizationCombobox({
  value,
  onChange,
  type,
  placeholder = "Select organization...",
}: OrganizationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgAddress, setNewOrgAddress] = useState("");
  const [newOrgContactName, setNewOrgContactName] = useState("");
  const [newOrgContactEmail, setNewOrgContactEmail] = useState("");
  const [newOrgContactPhone, setNewOrgContactPhone] = useState("");
  const { toast } = useToast();

  const { data: organizations = [] } = useQuery<Organization[]>({
    queryKey: ["/api/organizations", { type }],
    queryFn: async () => {
      const response = await fetch(`/api/organizations?type=${type}`);
      if (!response.ok) throw new Error("Failed to fetch organizations");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      type: string;
      address?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    }) => {
      return await apiRequest("/api/organizations", "POST", data);
    },
    onSuccess: (newOrg: Organization) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organizations"] });
      onChange(newOrg.id);
      setDialogOpen(false);
      setNewOrgName("");
      setNewOrgAddress("");
      setNewOrgContactName("");
      setNewOrgContactEmail("");
      setNewOrgContactPhone("");
      toast({
        title: "Success",
        description: "Organization created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
    },
  });

  const selectedOrg = organizations.find((org) => org.id === value);

  const handleCreate = () => {
    if (!newOrgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      name: newOrgName.trim(),
      type: type === "shipper" ? "shipper" : "consignee",
      address: newOrgAddress.trim() || undefined,
      contactName: newOrgContactName.trim() || undefined,
      contactEmail: newOrgContactEmail.trim() || undefined,
      contactPhone: newOrgContactPhone.trim() || undefined,
    });
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            data-testid={`button-select-${type}`}
          >
            {selectedOrg ? selectedOrg.name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={`Search ${type}s...`} data-testid={`input-search-${type}`} />
            <CommandEmpty>
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground">No {type} found</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setOpen(false);
                    setDialogOpen(true);
                  }}
                  data-testid={`button-create-${type}-from-empty`}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create New {type === "shipper" ? "Shipper" : "Consignee"}
                </Button>
              </div>
            </CommandEmpty>
            <CommandGroup>
              {organizations.map((org) => (
                <CommandItem
                  key={org.id}
                  value={org.id}
                  onSelect={() => {
                    onChange(org.id);
                    setOpen(false);
                  }}
                  data-testid={`option-${type}-${org.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === org.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {org.name}
                </CommandItem>
              ))}
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  setDialogOpen(true);
                }}
                className="border-t"
                data-testid={`button-create-new-${type}`}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add New {type === "shipper" ? "Shipper" : "Consignee"}
              </CommandItem>
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid={`dialog-create-${type}`}>
          <DialogHeader>
            <DialogTitle>Create New {type === "shipper" ? "Shipper" : "Consignee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="org-name">Company Name *</Label>
              <Input
                id="org-name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="e.g., ABC Company Ltd."
                data-testid={`input-new-${type}-name`}
              />
            </div>
            <div>
              <Label htmlFor="org-address">Address</Label>
              <Input
                id="org-address"
                value={newOrgAddress}
                onChange={(e) => setNewOrgAddress(e.target.value)}
                placeholder="Full address (optional)"
                data-testid={`input-new-${type}-address`}
              />
            </div>
            <div>
              <Label htmlFor="org-contact-name">Contact Name</Label>
              <Input
                id="org-contact-name"
                value={newOrgContactName}
                onChange={(e) => setNewOrgContactName(e.target.value)}
                placeholder="Contact person (optional)"
                data-testid={`input-new-${type}-contact-name`}
              />
            </div>
            <div>
              <Label htmlFor="org-contact-email">Contact Email</Label>
              <Input
                id="org-contact-email"
                value={newOrgContactEmail}
                onChange={(e) => setNewOrgContactEmail(e.target.value)}
                placeholder="email@example.com (optional)"
                data-testid={`input-new-${type}-contact-email`}
              />
            </div>
            <div>
              <Label htmlFor="org-contact-phone">Contact Phone</Label>
              <Input
                id="org-contact-phone"
                value={newOrgContactPhone}
                onChange={(e) => setNewOrgContactPhone(e.target.value)}
                placeholder="+1 (555) 123-4567 (optional)"
                data-testid={`input-new-${type}-contact-phone`}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid={`button-cancel-${type}`}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid={`button-save-${type}`}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
