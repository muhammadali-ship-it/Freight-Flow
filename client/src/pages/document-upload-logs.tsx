import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DocumentUploadLog {
  id: string;
  batchId: string;
  totalFiles: number;
  successfulUploads: number;
  failedUploads: number;
  uploadStartedAt: string;
  uploadCompletedAt?: string;
  apiRequest?: string;
  apiResponse?: string;
  errorDetails?: string;
}

interface PaginatedResult {
  data: DocumentUploadLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function DocumentUploadLogs() {
  const [page, setPage] = useState(1);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<PaginatedResult>({
    queryKey: ["/api/cargoes-flow/document-upload-logs", page],
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedLogs(newExpanded);
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return "—";
    const duration = new Date(end).getTime() - new Date(start).getTime();
    return `${(duration / 1000).toFixed(2)}s`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const logs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Document Upload Logs</h1>
        <p className="text-muted-foreground">
          Track bulk document uploads to Cargoes Flow API
        </p>
      </div>

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No upload logs found</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload logs will appear here after you use the bulk document upload feature
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => {
            const isExpanded = expandedLogs.has(log.id);
            const successRate = log.totalFiles > 0 
              ? ((log.successfulUploads / log.totalFiles) * 100).toFixed(0)
              : "0";

            return (
              <Card key={log.id}>
                <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(log.id)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{log.batchId}</CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          {new Date(log.uploadStartedAt).toLocaleString()}
                          {log.uploadCompletedAt && (
                            <span className="text-xs">
                              (Duration: {formatDuration(log.uploadStartedAt, log.uploadCompletedAt)})
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                          {log.totalFiles} Files
                        </Badge>
                        <Badge 
                          variant={log.successfulUploads === log.totalFiles ? "default" : log.successfulUploads > 0 ? "secondary" : "destructive"}
                          className="gap-1"
                        >
                          {successRate}% Success
                        </Badge>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon">
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-sm font-medium">{log.successfulUploads}</p>
                          <p className="text-xs text-muted-foreground">Successful</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <div>
                          <p className="text-sm font-medium">{log.failedUploads}</p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{log.totalFiles}</p>
                          <p className="text-xs text-muted-foreground">Total Files</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-4 border-t">
                      {log.apiRequest && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">API Request</h4>
                          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(JSON.parse(log.apiRequest), null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.apiResponse && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2">API Response</h4>
                          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-60">
                            {JSON.stringify(JSON.parse(log.apiResponse), null, 2)}
                          </pre>
                        </div>
                      )}

                      {log.errorDetails && (
                        <div>
                          <h4 className="font-semibold text-sm mb-2 text-destructive">Error Details</h4>
                          <pre className="bg-destructive/10 p-3 rounded text-xs overflow-auto max-h-40 text-destructive">
                            {log.errorDetails}
                          </pre>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total logs)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
