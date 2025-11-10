import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SyncLog {
  id: string;
  status: string;
  shipmentsProcessed: number;
  shipmentsCreated: number;
  shipmentsUpdated: number;
  errorMessage?: string;
  syncDurationMs: number;
  metadata?: {
    totalFetched?: number;
    timestamp?: string;
    error?: string;
  };
  createdAt: string;
}

interface SyncLogsResponse {
  data: SyncLog[];
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
  };
}

export default function CargoesFlowSyncLogs() {
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { data: logsData, isLoading } = useQuery<SyncLogsResponse>({
    queryKey: [`/api/cargoes-flow/sync-logs?page=${page}&pageSize=${pageSize}`],
  });

  const toggleLogExpanded = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-sync-logs">
            Cargoes Flow Sync Logs
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Detailed history of all API sync attempts
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync History</CardTitle>
          <CardDescription>
            All sync attempts with detailed API request/response information
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No sync logs available</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const isExpanded = expandedLogs.has(log.id);
                
                return (
                  <Collapsible key={log.id} open={isExpanded} onOpenChange={() => toggleLogExpanded(log.id)}>
                    <Card className="border-l-4" style={{
                      borderLeftColor: log.status === 'success' 
                        ? 'hsl(var(--success))' 
                        : 'hsl(var(--destructive))'
                    }}>
                      <CollapsibleTrigger className="w-full" asChild>
                        <div className="p-4 hover-elevate cursor-pointer">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {log.status === 'success' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                                    {log.status.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {formatDate(log.createdAt)}
                                  </span>
                                </div>
                                
                                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                  <div>
                                    <p className="text-muted-foreground text-xs">Processed</p>
                                    <p className="font-medium">{log.shipmentsProcessed}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs">Created</p>
                                    <p className="font-medium text-green-600">{log.shipmentsCreated}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs">Updated</p>
                                    <p className="font-medium text-blue-600">{log.shipmentsUpdated}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground text-xs">Duration</p>
                                    <p className="font-medium">{formatDuration(log.syncDurationMs)}</p>
                                  </div>
                                </div>

                                {log.errorMessage && (
                                  <div className="mt-2">
                                    <p className="text-sm text-destructive font-medium">Error: {log.errorMessage}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Button variant="ghost" size="icon" className="flex-shrink-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2 border-t space-y-3">
                          <div>
                            <h4 className="text-sm font-semibold mb-2">API Request Details</h4>
                            <div className="bg-muted p-3 rounded-md text-xs font-mono space-y-1">
                              <p><span className="text-muted-foreground">URL:</span> https://connect.cargoes.com/flow/api/public_tracking/v1/shipments</p>
                              <p><span className="text-muted-foreground">Method:</span> GET</p>
                              <p><span className="text-muted-foreground">Parameters:</span> shipmentType=INTERMODAL_SHIPMENT&status=ACTIVE</p>
                              <p><span className="text-muted-foreground">Headers:</span> X-DPW-ApiKey, X-DPW-Org-Token</p>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold mb-2">Response Summary</h4>
                            <div className="bg-muted p-3 rounded-md text-xs font-mono space-y-1">
                              <p><span className="text-muted-foreground">Status:</span> {log.status === 'success' ? '200 OK' : 'Error'}</p>
                              <p><span className="text-muted-foreground">Records Received:</span> {log.shipmentsProcessed}</p>
                              <p><span className="text-muted-foreground">Processing Time:</span> {formatDuration(log.syncDurationMs)}</p>
                              {log.metadata?.timestamp && (
                                <p><span className="text-muted-foreground">Timestamp:</span> {log.metadata.timestamp}</p>
                              )}
                            </div>
                          </div>

                          {log.metadata && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Additional Metadata</h4>
                              <div className="bg-muted p-3 rounded-md">
                                <pre className="text-xs font-mono overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} total)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  data-testid="button-previous-page"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= pagination.totalPages}
                  data-testid="button-next-page"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
