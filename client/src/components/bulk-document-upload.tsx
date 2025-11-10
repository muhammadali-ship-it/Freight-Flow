import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

interface UploadResult {
  fileName: string;
  success: boolean;
  organizationId?: string;
  organizationName?: string;
  documentExtension?: string;
  createdAt?: string;
  error?: string;
}

export function BulkDocumentUpload() {
  const [shipmentNumber, setShipmentNumber] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!shipmentNumber || selectedFiles.length === 0) {
        throw new Error("Shipment number and files are required");
      }

      const filesData = await Promise.all(
        selectedFiles.map(async (file) => {
          const reader = new FileReader();
          return new Promise<any>((resolve, reject) => {
            reader.onload = () => {
              const base64Data = reader.result as string;
              const extension = file.name.split('.').pop() || '';
              resolve({
                fileName: file.name,
                fileExtension: extension,
                fileData: base64Data,
                fileSize: file.size,
              });
            };
            reader.onerror = () => reject(new Error("Failed to read file"));
            reader.readAsDataURL(file);
          });
        })
      );

      const response = await apiRequest("POST", "/api/cargoes-flow/upload-documents", {
        shipmentNumber,
        files: filesData,
      });

      return response.json();
    },
    onSuccess: (data) => {
      setUploadResults(data.results);
      toast({
        title: "Upload Complete",
        description: `Successfully uploaded ${data.successfulUploads} of ${data.totalFiles} documents`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload documents",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(Array.from(e.target.files));
      setUploadResults(null);
    }
  };

  const handleUpload = () => {
    uploadMutation.mutate();
  };

  const handleReset = () => {
    setShipmentNumber("");
    setSelectedFiles([]);
    setUploadResults(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Document Upload
        </CardTitle>
        <CardDescription>
          Upload multiple documents to Cargoes Flow by shipment number. Documents will be tracked separately
          and linked to shipments when they become Active in the system.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This uploads documents directly to Cargoes Flow API. Shipments uploaded via documents will be tracked
            separately and linked to Active shipments received from the polling service.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label htmlFor="shipment-number">Shipment Number *</Label>
            <Input
              id="shipment-number"
              placeholder="Enter shipment number (e.g., TS-5HKANN)"
              value={shipmentNumber}
              onChange={(e) => setShipmentNumber(e.target.value)}
              disabled={uploadMutation.isPending}
              data-testid="input-shipment-number"
            />
          </div>

          <div>
            <Label htmlFor="files">Select Documents *</Label>
            <Input
              id="files"
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={uploadMutation.isPending}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              data-testid="input-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                {selectedFiles.length} file(s) selected
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={!shipmentNumber || selectedFiles.length === 0 || uploadMutation.isPending}
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload to Cargoes Flow
                </>
              )}
            </Button>
            {(selectedFiles.length > 0 || uploadResults) && (
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={uploadMutation.isPending}
                data-testid="button-reset"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {uploadResults && uploadResults.length > 0 && (
          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold">Upload Results</h3>
            <div className="space-y-2">
              {uploadResults.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  data-testid={`result-${index}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{result.fileName}</p>
                      {result.success && result.organizationName && (
                        <p className="text-xs text-muted-foreground">
                          Organization: {result.organizationName}
                        </p>
                      )}
                      {result.error && (
                        <p className="text-xs text-destructive">{result.error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Success
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Failed
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
