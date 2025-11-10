import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Ship, RefreshCw, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Carrier {
  id: string;
  carrierName: string;
  carrierScac: string | null;
  shipmentType: string | null;
  supportsTrackByMbl: boolean;
  supportsTrackByBookingNumber: boolean;
  requiresMbl: boolean;
  lastSyncedAt: string;
}

export function CarriersWidget() {
  const { toast } = useToast();

  const { data: carriers, isLoading } = useQuery<Carrier[]>({
    queryKey: ["/api/cargoes-flow/carriers"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/cargoes-flow/carriers/sync", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync carriers");
      return await res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargoes-flow/carriers"] });
      toast({
        title: "Carriers synced successfully",
        description: `Processed: ${data.carriersProcessed}, Created: ${data.carriersCreated}, Updated: ${data.carriersUpdated}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Carrier sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const intermodalCarriers = carriers?.filter((c) => c.shipmentType === "INTERMODAL_SHIPMENT") || [];
  const airCarriers = carriers?.filter((c) => c.shipmentType === "AIR_SHIPMENT") || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Carriers
          </CardTitle>
          <CardDescription>
            Carriers from Cargoes Flow API
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-sync-carriers"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync
          </Button>
          <Link href="/cargoes-flow/carrier-logs">
            <Button variant="ghost" size="sm" data-testid="link-carrier-logs">
              <ExternalLink className="h-4 w-4 mr-2" />
              Logs
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : !carriers || carriers.length === 0 ? (
          <div className="text-center py-8">
            <Ship className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-sm text-muted-foreground mb-4">No carriers found</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              data-testid="button-sync-carriers-empty"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Carriers
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{carriers.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{intermodalCarriers.length}</p>
                <p className="text-xs text-muted-foreground">Intermodal</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{airCarriers.length}</p>
                <p className="text-xs text-muted-foreground">Air</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {carriers.filter((c) => c.supportsTrackByMbl).length}
                </p>
                <p className="text-xs text-muted-foreground">Track by MBL</p>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-auto">
              <p className="text-sm font-medium">Recent Carriers ({Math.min(carriers.length, 10)})</p>
              {carriers.slice(0, 10).map((carrier) => (
                <div
                  key={carrier.id}
                  className="flex items-center justify-between p-2 rounded-md border hover-elevate"
                  data-testid={`carrier-${carrier.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{carrier.carrierName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {carrier.carrierScac && (
                        <Badge variant="outline" className="text-xs">
                          {carrier.carrierScac}
                        </Badge>
                      )}
                      {carrier.shipmentType && (
                        <Badge variant="secondary" className="text-xs">
                          {carrier.shipmentType.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {carrier.supportsTrackByMbl && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        MBL
                      </Badge>
                    )}
                    {carrier.supportsTrackByBookingNumber && (
                      <Badge variant="outline" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Booking
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
