import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Container, Ship, TrendingUp, Clock } from "lucide-react";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    email: "",
    password: "",
    name: "",
    role: "user" as "admin" | "user" | "manager",
  });

  if (user) {
    setLocation("/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync(loginForm);
      setLocation("/");
    } catch (error) {
      // Error is already handled by onError in the mutation
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerMutation.mutateAsync(registerForm);
      setLocation("/");
    } catch (error) {
      // Error is already handled by onError in the mutation
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex flex-1 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center mb-4">
              <Container className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">Container Tracking System</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Freight operations management platform
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>
                Enter your credentials to access your account
              </CardDescription>
            </CardHeader>
                <CardContent>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-username">Username</Label>
                      <Input
                        id="login-username"
                        data-testid="input-login-username"
                        type="text"
                        placeholder="Enter your username"
                        value={loginForm.username}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, username: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        data-testid="input-login-password"
                        type="password"
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(e) =>
                          setLoginForm({ ...loginForm, password: e.target.value })
                        }
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? "Logging in..." : "Login"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
        </div>
      </div>

      <div className="hidden lg:flex flex-1 items-center justify-center p-12 bg-primary/5">
        <div className="max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-semibold text-foreground mb-4">
              Complete Freight Operations Visibility
            </h2>
            <p className="text-muted-foreground">
              Track containers, monitor shipments, and manage exceptions in real-time. Built for freight brokers and logistics professionals.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Ship className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Real-time Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor container status, vessel positions, and shipping milestones
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Demurrage Alerts</h3>
                <p className="text-sm text-muted-foreground">
                  Automatic alerts for last free day and demurrage calculations
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Analytics Dashboard</h3>
                <p className="text-sm text-muted-foreground">
                  KPI tracking, performance metrics, and operational insights
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
