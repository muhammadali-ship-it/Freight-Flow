import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, ChevronLeft, ChevronRight, Ship, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";

interface CarrierSyncLog {
  id: string;
  status: string;
  carriersProcessed: number;
  carriersCreated: number;
  carriersUpdated: number;
  errorMessage: string | null;
  syncDurationMs: number;
  apiRequest: string | null;
  apiResponse: string | null;
  createdAt: string;
}

export default function CarrierLogs() {
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<CarrierSyncLog | null>(null);
  const pageSize = 50;

  const { data, isLoading, refetch, isFetching } = useQuery<{
    logs: CarrierSyncLog[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/cargoes-flow/carriers/sync-logs", page, pageSize],
    queryFn: async () => {
      const res = await fetch(`/api/cargoes-flow/carriers/sync-logs?page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error("Failed to fetch carrier sync logs");
      return res.json();
    },
  });

  const logs = data?.logs || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Ship className="h-8 w-8" />
            Carrier Sync Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Track carrier synchronization history from Cargoes Flow API
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          className="w-full sm:w-auto"
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
          <CardDescription>
            All carrier synchronization attempts from Cargoes Flow API
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <Ship className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No carrier sync logs yet</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead className="text-right">Processed</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-carrier-log-${log.id}`}>
                        <TableCell>
                          {log.status === "success" ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Error
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {log.carriersProcessed}
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400">
                          {log.carriersCreated}
                        </TableCell>
                        <TableCell className="text-right text-blue-600 dark:text-blue-400">
                          {log.carriersUpdated}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {log.syncDurationMs}ms
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            data-testid={`button-view-details-${log.id}`}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      data-testid="button-previous-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page >= pagination.totalPages}
                      data-testid="button-next-page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Carrier Sync Log Details</DialogTitle>
            <DialogDescription>
              {selectedLog && format(new Date(selectedLog.createdAt), "PPpp")}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="h-[60vh] pr-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    {selectedLog.status === "success" ? (
                      <Badge variant="default" className="gap-1 mt-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1 mt-1">
                        <XCircle className="h-3 w-3" />
                        Error
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duration</p>
                    <p className="text-lg font-mono mt-1">{selectedLog.syncDurationMs}ms</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Processed</p>
                    <p className="text-2xl font-bold">{selectedLog.carriersProcessed}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {selectedLog.carriersCreated}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Updated</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {selectedLog.carriersUpdated}
                    </p>
                  </div>
                </div>

                {selectedLog.errorMessage && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Error Message</p>
                      <div className="bg-destructive/10 text-destructive p-4 rounded-md font-mono text-sm">
                        {selectedLog.errorMessage}
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.apiRequest && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">API Request</p>
                      <div className="bg-muted p-4 rounded-md font-mono text-sm overflow-auto">
                        {selectedLog.apiRequest}
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.apiResponse && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">API Response</p>
                      <div className="bg-muted p-4 rounded-md font-mono text-xs overflow-auto max-h-96">
                        <pre>{selectedLog.apiResponse}</pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
