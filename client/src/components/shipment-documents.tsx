import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Upload, Download, Trash2, Eye, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface ShipmentDocument {
  id: string;
  shipmentId: string;
  documentType: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  fileData?: string;
  description?: string;
  uploadedAt: string;
}

const DOCUMENT_TYPES = [
  { value: "BOL", label: "Bill of Lading" },
  { value: "COMMERCIAL_INVOICE", label: "Commercial Invoice" },
  { value: "PACKING_LIST", label: "Packing List" },
  { value: "CUSTOMS_DECLARATION", label: "Customs Declaration" },
  { value: "CERTIFICATE_OF_ORIGIN", label: "Certificate of Origin" },
  { value: "INSURANCE_CERTIFICATE", label: "Insurance Certificate" },
  { value: "DELIVERY_ORDER", label: "Delivery Order" },
  { value: "ARRIVAL_NOTICE", label: "Arrival Notice" },
  { value: "OTHER", label: "Other" },
];

function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

export function ShipmentDocuments({ shipmentId }: { shipmentId: string }) {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [documentType, setDocumentType] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const { data: documents, isLoading } = useQuery<ShipmentDocument[]>({
    queryKey: ["/api/shipments", shipmentId, "documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !documentType) {
        throw new Error("File and document type are required");
      }

      const reader = new FileReader();
      return new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const response = await apiRequest("POST", `/api/shipments/${shipmentId}/documents`, {
              documentType,
              fileName: selectedFile.name,
              fileSize: selectedFile.size,
              mimeType: selectedFile.type,
              fileData: base64Data,
              description,
            });
            resolve(response);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(selectedFile);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId, "documents"] });
      toast({
        title: "Document uploaded",
        description: "The document has been uploaded successfully.",
      });
      setIsUploadOpen(false);
      setSelectedFile(null);
      setDocumentType("");
      setDescription("");
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest("DELETE", `/api/documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId, "documents"] });
      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete document",
        variant: "destructive",
      });
    },
  });

  const handleDownload = (doc: ShipmentDocument) => {
    if (doc.fileData) {
      const link = document.createElement("a");
      link.href = doc.fileData;
      link.download = doc.fileName;
      link.click();
    }
  };

  const handleView = (doc: ShipmentDocument) => {
    if (doc.fileData) {
      window.open(doc.fileData, "_blank");
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documents ({documents?.length || 0})
        </CardTitle>
        
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-upload-document">
              <Upload className="mr-2 h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload shipping documents such as BOL, customs paperwork, or other related files.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="document-type">Document Type *</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger id="document-type" data-testid="select-document-type">
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="file-upload">File *</Label>
                <Input
                  id="file-upload"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  data-testid="input-file-upload"
                />
                {selectedFile && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  data-testid="input-description"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)} data-testid="button-cancel-upload">
                Cancel
              </Button>
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!selectedFile || !documentType || uploadMutation.isPending}
                data-testid="button-confirm-upload"
              >
                {uploadMutation.isPending ? "Uploading..." : "Upload"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <CardContent>
        {!documents || documents.length === 0 ? (
          <div className="text-center py-8">
            <File className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload BOL, customs paperwork, or other shipping documents
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const docType = DOCUMENT_TYPES.find((t) => t.value === doc.documentType);
              
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover-elevate"
                  data-testid={`document-${doc.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{doc.fileName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {docType?.label || doc.documentType}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {doc.fileData && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleView(doc)}
                          data-testid={`button-view-${doc.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(doc)}
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(doc.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${doc.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
