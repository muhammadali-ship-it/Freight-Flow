import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CustomEntry } from "@shared/schema";

interface CreatableComboboxProps {
  type: 'carrier' | 'port' | 'terminal';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  testId?: string;
  staticOptions?: { value: string; code?: string; label?: string }[];
  allowCreate?: boolean;
}

export function CreatableCombobox({ 
  type,
  value, 
  onChange, 
  placeholder = `Select ${type}`,
  testId = `combobox-${type}`,
  staticOptions = [],
  allowCreate = true
}: CreatableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { toast } = useToast();

  const { data: customEntries = [] } = useQuery<CustomEntry[]>({
    queryKey: [`/api/custom-entries/${type}`],
  });

  const createMutation = useMutation({
    mutationFn: async (newValue: string) => {
      return await apiRequest("POST", `/api/custom-entries`, { 
        type, 
        value: newValue.trim()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/custom-entries/${type}`] });
      toast({
        title: "Success",
        description: `Custom ${type} saved successfully`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to save custom ${type}`,
      });
    },
  });

  const allOptions = [
    ...staticOptions.map(opt => ({ 
      value: opt.value, 
      label: opt.label || opt.value,
      code: opt.code || undefined,
      isCustom: false 
    })),
    ...customEntries.map(entry => ({ 
      value: entry.value, 
      label: entry.value,
      code: undefined,
      isCustom: true 
    })),
  ];

  const selectedOption = allOptions.find((opt) => opt.value === value);
  const displayValue = selectedOption 
    ? (selectedOption.code ? `${selectedOption.label} (${selectedOption.code})` : selectedOption.label)
    : value || placeholder;

  const filteredOptions = searchValue 
    ? allOptions.filter(opt => 
        opt.label.toLowerCase().includes(searchValue.toLowerCase()) ||
        opt.code?.toLowerCase().includes(searchValue.toLowerCase())
      )
    : allOptions;

  const exactMatch = allOptions.some(opt => 
    opt.value.toLowerCase() === searchValue.toLowerCase()
  );

  const canCreate = allowCreate && searchValue.trim() && !exactMatch;

  const handleCreate = () => {
    const newValue = searchValue.trim();
    onChange(newValue);
    createMutation.mutate(newValue);
    setOpen(false);
    setSearchValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
          data-testid={testId}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={`Search ${type}s...`} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !canCreate && (
              <CommandEmpty>No {type} found.</CommandEmpty>
            )}
            {filteredOptions.length > 0 && (
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                      setSearchValue("");
                    }}
                    data-testid={`${type}-option-${option.value.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1">{option.label}</span>
                    {option.code && (
                      <span className="text-xs text-muted-foreground ml-2">{option.code}</span>
                    )}
                    {option.isCustom && (
                      <span className="text-xs text-muted-foreground ml-2">(custom)</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  onSelect={handleCreate}
                  data-testid={`button-create-${type}`}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>Create "{searchValue}"</span>
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
