import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Shield, User as UserIcon } from "lucide-react";
import type { User } from "@shared/schema";

const OFFICE_OPTIONS = [
  "Logistics Sales-Domestic Operations",
  "Logistics Sales-Jake",
  "Logistics Sales-Mark",
  "Logistics Sales-Sarah",
  "Logistics-Sales-Alan",
  "LDP Logistics, Inc.",
] as const;

const userFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["Admin", "Manager", "User"]),
  office: z.enum([
    "Logistics Sales-Domestic Operations",
    "Logistics Sales-Jake",
    "Logistics Sales-Mark",
    "Logistics Sales-Sarah",
    "Logistics-Sales-Alan",
    "LDP Logistics, Inc.",
  ]),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function Users() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Omit<User, "password"> | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  const { data: currentUser } = useQuery<{ id: string; role: string; name: string; email: string }>({
    queryKey: ["/api/user"],
  });

  const { data: users = [], isLoading } = useQuery<Omit<User, "password">[]>({
    queryKey: ["/api/users"],
  });

  const isAdmin = currentUser?.role === "Admin";
  const displayUsers = isAdmin ? users : users.filter(u => u.id === currentUser?.id);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      name: "",
      email: "",
      role: "User",
      office: "Logistics Sales-Domestic Operations",
      password: "",
    },
  });

  // Ensure form is populated when editing user
  useEffect(() => {
    if (editingUser && dialogOpen) {
      console.log("Setting form values for user:", editingUser);
      console.log("User role:", editingUser.role);
      
      // Ensure role is valid, fallback to "User" if invalid
      const validRole = ["Admin", "Manager", "User"].includes(editingUser.role) 
        ? editingUser.role as "Admin" | "Manager" | "User"
        : "User";
      
      form.reset({
        username: editingUser.username || "",
        name: editingUser.name,
        email: editingUser.email,
        role: validRole,
        office: (editingUser.office || "Logistics Sales-Domestic Operations") as typeof OFFICE_OPTIONS[number],
        password: "",
      });
      
      // Force set the role value to ensure it's properly set
      form.setValue("role", validRole);
      
      // Clear any existing form errors
      form.clearErrors();
    }
  }, [editingUser, dialogOpen, form]);

  const createMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      return await apiRequest("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormValues> }) => {
      return await apiRequest(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated successfully" });
      setDialogOpen(false);
      setEditingUser(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update user", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/users/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
      setDeleteUserId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (values: UserFormValues) => {
    if (editingUser) {
      const updateData: Partial<UserFormValues> = { ...values };
      if (!values.password) {
        delete updateData.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(values);
    }
  };

  const openEditDialog = (user: Omit<User, "password">) => {
    setEditingUser(user);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    form.reset({
      username: "",
      name: "",
      email: "",
      role: "User",
      office: "Logistics Sales-Domestic Operations",
      password: "",
    });
    setDialogOpen(true);
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "Admin":
        return "default";
      case "Manager":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    return role === "Admin" ? Shield : UserIcon;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-users">
            {isAdmin ? "User Management" : "My Profile"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isAdmin ? "Manage users and their roles" : "View and edit your profile"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          {isAdmin && (
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} data-testid="button-add-user">
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
          )}
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle data-testid="dialog-title-user">
                {editingUser ? "Edit User" : "Create New User"}
              </DialogTitle>
              <DialogDescription>
                {editingUser ? "Update user information and role" : "Add a new user to the system"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="john.doe" data-testid="input-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="John Doe" data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="john@example.com" data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value} 
                        defaultValue={field.value} 
                        disabled={!isAdmin}
                        key={editingUser?.id || 'new'}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="User">User</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="office"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Office</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-office">
                            <SelectValue placeholder="Select office" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OFFICE_OPTIONS.map((office) => (
                            <SelectItem key={office} value={office}>
                              {office}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{editingUser ? "New Password (Optional)" : "Password"}</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder={editingUser ? "Leave blank to keep current" : "••••••••"} data-testid="input-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-user">
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Loading...
          </CardContent>
        </Card>
      ) : displayUsers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{isAdmin ? "Users" : "Profile Information"}</CardTitle>
            <CardDescription>
              {isAdmin 
                ? `${displayUsers.length} ${displayUsers.length === 1 ? "user" : "users"} in the system`
                : "Your account details"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-username">Username</TableHead>
                    <TableHead data-testid="header-name">Name</TableHead>
                    <TableHead data-testid="header-email">Email</TableHead>
                    <TableHead data-testid="header-role">Role</TableHead>
                    <TableHead data-testid="header-office">Office</TableHead>
                    <TableHead className="text-right" data-testid="header-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayUsers.map((user) => {
                    const RoleIcon = getRoleIcon(user.role);
                    const canEdit = isAdmin || user.id === currentUser?.id;
                    const canDelete = isAdmin && user.id !== currentUser?.id;
                    return (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-mono text-sm" data-testid={`text-username-${user.id}`}>
                          {user.username || <span className="text-muted-foreground italic">not set</span>}
                        </TableCell>
                        <TableCell className="font-medium" data-testid={`text-name-${user.id}`}>
                          {user.name}
                        </TableCell>
                        <TableCell data-testid={`text-email-${user.id}`}>
                          {user.email}
                        </TableCell>
                        <TableCell data-testid={`badge-role-${user.id}`}>
                          <Badge variant={getRoleBadgeVariant(user.role)}>
                            <RoleIcon className="h-3 w-3 mr-1" />
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-office-${user.id}`}>
                          {user.office || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(user)}
                                data-testid={`button-edit-${user.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteUserId(user.id)}
                                data-testid={`button-delete-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="dialog-title-delete">Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user and remove their data from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
