import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { buildApiUrl } from "@/lib/env";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Ship, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCcw,
  RotateCcw,
  AlertTriangle,
  Trash2,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CargoesFlowPost {
  id: string;
  shipmentReference: string;
  mblNumber: string;
  webhookId: string | null;
  status: string;
  responseData: any;
  errorMessage: string | null;
  postedAt: string;
  createdAt: string;
}

interface PostsResponse {
  data: CargoesFlowPost[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface MissingMblShipment {
  id: string;
  shipmentReference: string;
  webhookId: string | null;
  containerNumber: string | null;
  shipper: string | null;
  consignee: string | null;
  originPort: string | null;
  destinationPort: string | null;
  carrier: string | null;
  status: string | null;
  receivedAt: string;
  createdAt: string;
}

interface MissingMblResponse {
  data: MissingMblShipment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export default function CargoesFlowTracking() {
  const [page, setPage] = useState(1);
  const [missingPage, setMissingPage] = useState(1);
  const [search, setSearch] = useState("");
  const [missingSearch, setMissingSearch] = useState("");
  const pageSize = 50;
  const { toast } = useToast();

  const buildPostsQueryUrl = () => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('pageSize', pageSize.toString());
    if (search.trim()) {
      params.append('search', search.trim());
    }
    return `${buildApiUrl("/api/cargoes-flow/posts")}?${params.toString()}`;
  };

  const buildMissingQueryUrl = () => {
    const params = new URLSearchParams();
    params.append('page', missingPage.toString());
    params.append('pageSize', pageSize.toString());
    if (missingSearch.trim()) {
      params.append('search', missingSearch.trim());
    }
    return `${buildApiUrl("/api/cargoes-flow/missing-mbl")}?${params.toString()}`;
  };

  const { data, isLoading, refetch } = useQuery<PostsResponse>({
    queryKey: [buildPostsQueryUrl()],
    queryFn: async () => {
      const response = await fetch(buildPostsQueryUrl(), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  const { data: missingData, isLoading: missingLoading } = useQuery<MissingMblResponse>({
    queryKey: [buildMissingQueryUrl()],
    queryFn: async () => {
      const response = await fetch(buildMissingQueryUrl(), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch missing MBL shipments");
      return response.json();
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("POST", `/api/cargoes-flow/retry/${postId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargoes-flow/posts"] });
      toast({
        title: "Retry Successful",
        description: "Shipment has been reposted to Cargoes Flow successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Retry Failed",
        description: error.message || "Failed to retry posting to Cargoes Flow.",
        variant: "destructive",
      });
    },
  });

  const deleteMissingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/cargoes-flow/missing-mbl/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargoes-flow/missing-mbl"] });
      toast({
        title: "Deleted",
        description: "Missing MBL shipment removed from tracking.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete shipment.",
        variant: "destructive",
      });
    },
  });

  const batchProcessMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cargoes-flow/batch-process");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cargoes-flow/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cargoes-flow/missing-mbl"] });
      toast({
        title: "Batch Processing Complete",
        description: `Posted: ${data.posted}, Missing MBL: ${data.missingMbl}, Errors: ${data.errors}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Batch Processing Failed",
        description: error.message || "Failed to process webhooks.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "success":
        return "default";
      case "failed":
        return "destructive";
      case "pending":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const handleRetry = (postId: string) => {
    retryMutation.mutate(postId);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Ship className="h-8 w-8" />
            Cargoes Flow Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor shipments automatically posted to Cargoes Flow and track those with missing MBL
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => batchProcessMutation.mutate()}
            disabled={batchProcessMutation.isPending}
            data-testid="button-batch-process"
          >
            <Ship className="h-4 w-4 mr-2" />
            {batchProcessMutation.isPending ? "Processing..." : "Process TAI Webhooks"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="posted" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="posted" data-testid="tab-posted">
            Posted ({data?.pagination.total || 0})
          </TabsTrigger>
          <TabsTrigger value="missing" data-testid="tab-missing">
            Missing MBL ({missingData?.pagination.total || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posted" className="mt-6">
          {/* Search for Posted Shipments */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference or MBL number..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
                data-testid="input-search-posted"
              />
            </div>
          </div>

          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Posted Shipments</CardTitle>
              <CardDescription>
                {data?.pagination.total || 0} shipments posted to Cargoes Flow
              </CardDescription>
            </div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">
                  Success: {data?.data.filter(p => p.status === 'success').length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-muted-foreground">
                  Failed: {data?.data.filter(p => p.status === 'failed').length || 0}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-muted-foreground">
                  Pending: {data?.data.filter(p => p.status === 'pending').length || 0}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading posted shipments...
            </div>
          ) : data?.data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No shipments posted yet</p>
              <p className="text-sm mt-1">
                Shipments will automatically appear here when received via ShipNexus webhooks
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Master B/L</TableHead>
                      <TableHead>Posted</TableHead>
                      <TableHead>Time Elapsed</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.data.map((post) => (
                      <TableRow key={post.id} data-testid={`row-post-${post.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(post.status)}
                            <Badge variant={getStatusBadgeVariant(post.status)} data-testid={`badge-status-${post.id}`}>
                              {post.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium font-mono text-sm" data-testid={`text-reference-${post.id}`}>
                            {post.shipmentReference}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {post.mblNumber}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(post.postedAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {formatDistanceToNow(new Date(post.postedAt), { addSuffix: true })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-destructive max-w-[200px] truncate">
                          {post.errorMessage || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {post.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRetry(post.id)}
                              disabled={retryMutation.isPending}
                              data-testid={`button-retry-${post.id}`}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Retry
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {data && data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      data-testid="button-prev-page"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= data.pagination.totalPages}
                      data-testid="button-next-page"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="missing" className="mt-6">
          {/* Search for Missing MBL Shipments */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by reference, container, carrier, shipper, or consignee..."
                value={missingSearch}
                onChange={(e) => {
                  setMissingSearch(e.target.value);
                  setMissingPage(1);
                }}
                className="pl-10"
                data-testid="input-search-missing"
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Missing MBL Shipments
                  </CardTitle>
                  <CardDescription>
                    {missingData?.pagination.total || 0} shipments received without Master Bill of Lading
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {missingLoading ? (
                <div className="text-center py-12 text-muted-foreground">
                  Loading missing MBL shipments...
                </div>
              ) : missingData?.data.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
                  <p className="text-lg font-medium">No missing MBL shipments</p>
                  <p className="text-sm mt-1">
                    All shipments from TAI TMS have MBL numbers
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Container</TableHead>
                          <TableHead>Carrier</TableHead>
                          <TableHead>Origin</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Shipper</TableHead>
                          <TableHead>Consignee</TableHead>
                          <TableHead>Received</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {missingData?.data.map((shipment) => (
                          <TableRow key={shipment.id} data-testid={`row-missing-${shipment.id}`}>
                            <TableCell>
                              <span className="font-medium font-mono text-sm" data-testid={`text-reference-${shipment.id}`}>
                                {shipment.shipmentReference}
                              </span>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {shipment.containerNumber || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {shipment.carrier || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {shipment.originPort || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                              {shipment.destinationPort || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.shipper || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {shipment.consignee || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">
                                {formatDistanceToNow(new Date(shipment.receivedAt), { addSuffix: true })}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteMissingMutation.mutate(shipment.id)}
                                disabled={deleteMissingMutation.isPending}
                                data-testid={`button-delete-${shipment.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {missingData && missingData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Page {missingData.pagination.page} of {missingData.pagination.totalPages} ({missingData.pagination.total} total)
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMissingPage(missingPage - 1)}
                          disabled={missingPage === 1}
                          data-testid="button-missing-prev-page"
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMissingPage(missingPage + 1)}
                          disabled={missingPage >= missingData.pagination.totalPages}
                          data-testid="button-missing-next-page"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
