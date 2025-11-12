import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  created: string[];
  updated: string[];
}

export default function BulkImport() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const processImportMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/containers/bulk-import", formData);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Import failed");
      }
      
      return response.json();
    },
    onSuccess: (result: ImportResult) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      
      if (result.success > 0) {
        toast({
          title: "Import Successful",
          description: `Successfully processed ${result.success} containers`,
        });
      }
      
      if (result.failed > 0) {
        toast({
          title: "Some imports failed",
          description: `${result.failed} containers could not be imported`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    const csvOrExcel = droppedFiles.find(
      f => f.type === "text/csv" || 
          f.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
          f.type === "application/vnd.ms-excel" ||
          f.name.endsWith(".csv") ||
          f.name.endsWith(".xlsx") ||
          f.name.endsWith(".xls")
    );
    
    if (csvOrExcel) {
      setFile(csvOrExcel);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleSubmit = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to import",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", user?.id || "");
    formData.append("userName", user?.name || "");

    processImportMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    const headers = [
      "containerNumber",
      "status",
      "origin",
      "destination",
      "carrier",
      "vesselName",
      "voyageNumber",
      "eta",
      "ata",
      "currentLocation",
      "lastFreeDay",
      "masterBillOfLading",
      "bookingReference",
      "sealNumber",
      "containerType",
      "weight",
      "customsStatus",
      "notes"
    ];

    const sampleData = [
      [
        "ABCD1234567",
        "in-transit",
        "Shanghai",
        "Los Angeles",
        "Maersk",
        "EMMA MAERSK",
        "123W",
        "2024-03-15",
        "",
        "Pacific Ocean",
        "2024-03-20",
        "BOL123456",
        "BKG789012",
        "SEAL456",
        "40HC",
        "25000",
        "pending",
        "High priority shipment"
      ],
      [
        "EFGH9876543",
        "at-port",
        "Singapore",
        "New York",
        "MSC",
        "MSC OSCAR",
        "456E",
        "2024-03-18",
        "2024-03-18",
        "Port of New York",
        "2024-03-22",
        "BOL654321",
        "BKG210987",
        "SEAL789",
        "20GP",
        "15000",
        "cleared",
        "Ready for pickup"
      ]
    ];

    const csvContent = [
      headers.join(","),
      ...sampleData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "container_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Bulk Import</h1>
        <p className="text-muted-foreground mt-2">
          Import multiple containers at once from CSV or Excel files
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upload" data-testid="tab-upload">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results" disabled={!importResult}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Import Container Data</CardTitle>
              <CardDescription>
                Upload a CSV or Excel file with container information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={downloadTemplate}
                  data-testid="button-download-template"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </Button>
              </div>

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? "border-primary bg-accent" : "border-muted-foreground/25"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  data-testid="input-file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-muted-foreground mb-4" />
                  <span className="text-lg font-medium">
                    {file ? file.name : "Drop your file here or click to browse"}
                  </span>
                  <span className="text-sm text-muted-foreground mt-2">
                    Supports CSV and Excel files (max 10MB)
                  </span>
                </label>
              </div>

              {file && (
                <Alert>
                  <FileSpreadsheet className="h-4 w-4" />
                  <AlertTitle>File selected</AlertTitle>
                  <AlertDescription>
                    {file.name} ({(file.size / 1024).toFixed(2)} KB)
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                size="lg"
                onClick={handleSubmit}
                disabled={!file || processImportMutation.isPending}
                data-testid="button-start-import"
              >
                {processImportMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Import...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Start Import
                  </>
                )}
              </Button>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Import Guidelines</AlertTitle>
                <AlertDescription className="space-y-2 mt-2">
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    <li>Container numbers must be unique</li>
                    <li>Status should be one of: booking-confirmed, gate-in, loaded, departed, in-transit, arrived, unloaded, gate-out, delivered</li>
                    <li>Dates should be in YYYY-MM-DD format</li>
                    <li>Weight should be in kilograms</li>
                    <li>Leave cells empty for optional fields</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          {importResult && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Import Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{importResult.success}</p>
                        <p className="text-sm text-muted-foreground">Successful</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <XCircle className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold">{importResult.failed}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-2xl font-bold">{importResult.success + importResult.failed}</p>
                        <p className="text-sm text-muted-foreground">Total Rows</p>
                      </div>
                    </div>
                  </div>

                  {importResult.success > 0 && (
                    <Progress 
                      value={(importResult.success / (importResult.success + importResult.failed)) * 100} 
                      className="mt-4"
                    />
                  )}
                </CardContent>
              </Card>

              {importResult.errors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Import Errors</CardTitle>
                    <CardDescription>
                      The following rows could not be imported
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {importResult.errors.map((error, index) => (
                        <Alert key={index} variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Row {error.row}</AlertTitle>
                          <AlertDescription>
                            {error.error}
                            {error.data && (
                              <div className="mt-2 text-xs">
                                Container: {error.data.containerNumber || "Unknown"}
                              </div>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {(importResult.created.length > 0 || importResult.updated.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Processed Containers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {importResult.created.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Created ({importResult.created.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {importResult.created.map((id) => (
                            <Badge key={id} variant="default">
                              {id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {importResult.updated.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Updated ({importResult.updated.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {importResult.updated.map((id) => (
                            <Badge key={id} variant="secondary">
                              {id}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFile(null);
                    setImportResult(null);
                  }}
                >
                  Import Another File
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}