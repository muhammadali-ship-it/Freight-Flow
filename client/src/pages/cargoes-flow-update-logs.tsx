import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UpdateLog {
  id: string;
  shipmentNumber: string;
  shipmentReference?: string;
  taiShipmentId?: string;
  webhookId?: string;
  updateData?: any;
  status: string;
  responseData?: any;
  errorMessage?: string;
  postedAt: string;
  createdAt: string;
}

interface UpdateLogsResponse {
  data: UpdateLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function CargoesFlowUpdateLogs() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 25;
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { data: logsData, isLoading, refetch } = useQuery<UpdateLogsResponse>({
    queryKey: [`/api/cargoes-flow/update-logs`, { page, pageSize, search }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        ...(search && { search }),
      });
      const response = await fetch(`/api/cargoes-flow/update-logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch update logs');
      return response.json();
    },
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

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination;

  const successCount = logs.filter(log => log.status === 'success').length;
  const failedCount = logs.filter(log => log.status === 'failed').length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold" data-testid="heading-update-logs">
            Cargoes Flow Update Tracking
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Updates sent to Cargoes Flow API for shipment modifications
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Update History</CardTitle>
          <CardDescription>
            All update attempts sent to Cargoes Flow updateShipments API
          </CardDescription>
          <div className="pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by shipment number, reference, or TAI ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading update logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'No update logs match your search' : 'No update logs available'}
            </div>
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
                        <div className="p-4 hover-elevate cursor-pointer" data-testid={`update-log-${log.id}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              {log.status === 'success' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant={log.status === 'success' ? 'default' : 'destructive'} data-testid={`badge-status-${log.id}`}>
                                    {log.status.toUpperCase()}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {formatDate(log.postedAt)}
                                  </span>
                                </div>
                                
                                <div className="mt-2 space-y-1">
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Shipment Number: </span>
                                    <span className="font-medium" data-testid={`text-shipment-number-${log.id}`}>{log.shipmentNumber}</span>
                                  </div>
                                  {log.shipmentReference && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Reference: </span>
                                      <span className="font-medium">{log.shipmentReference}</span>
                                    </div>
                                  )}
                                  {log.taiShipmentId && (
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">TAI ID: </span>
                                      <span className="font-medium">{log.taiShipmentId}</span>
                                    </div>
                                  )}
                                </div>

                                {log.errorMessage && (
                                  <div className="mt-2">
                                    <p className="text-sm text-destructive font-medium">Error: {log.errorMessage}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <Button variant="ghost" size="icon" className="flex-shrink-0" data-testid={`button-expand-${log.id}`}>
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
                          {log.updateData && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Update Data Sent</h4>
                              <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                                <pre>{JSON.stringify(log.updateData, null, 2)}</pre>
                              </div>
                            </div>
                          )}

                          {log.responseData && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">API Response</h4>
                              <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto">
                                <pre>{JSON.stringify(log.responseData, null, 2)}</pre>
                              </div>
                            </div>
                          )}

                          {log.webhookId && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Webhook ID</h4>
                              <div className="bg-muted p-2 rounded-md text-xs font-mono">
                                {log.webhookId}
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
            <div className="flex items-center justify-between gap-4 mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
