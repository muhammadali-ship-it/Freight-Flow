import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Ship, Package, AlertTriangle } from "lucide-react";
import { useEffect, useMemo } from "react";
import { PortCombobox } from "@/components/port-combobox";

const unifiedFormSchema = z.object({
  // Shipment Information
  referenceNumber: z.string().min(1, "Reference number is required"),
  bookingNumber: z.string().min(1, "Booking number is required"),
  masterBillOfLading: z.string().min(1, "Master Bill of Lading is required"),
  shipper: z.string().min(1, "Shipper is required"),
  consignee: z.string().min(1, "Consignee is required"),
  originPort: z.string().min(1, "Origin port is required"),
  destinationPort: z.string().min(1, "Destination port is required"),
  shipmentEtd: z.string().optional(),
  shipmentEta: z.string().optional(),
  shipmentCarrier: z.string().min(1, "Carrier is required"),
  shipmentVesselName: z.string().optional(),
  
  // Container Information
  containerNumber: z.string().min(11, "Container number must be at least 11 characters"),
  containerType: z.string().min(1, "Container type is required"),
  status: z.enum([
    "booking-confirmed",
    "gate-in",
    "loaded",
    "departed",
    "in-transit",
    "arrived",
    "unloaded",
    "gate-out",
    "delivered",
    "on-rail",
    "at-terminal",
    "customs-clearance",
    "delayed"
  ]),
  voyageNumber: z.string().optional(),
  bookingReference: z.string().optional(),
  sealNumber: z.string().optional(),
  weight: z.coerce.number().optional(),
  containerEta: z.string().optional(),
  ata: z.string().optional(),
  lastFreeDay: z.string().optional(),
  podTerminal: z.string().optional(),
  holdTypes: z.array(z.string()).optional(),
  customsStatus: z.enum(["pending", "cleared", "hold", "inspection", "released"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  priorityLevel: z.enum(["normal", "high", "urgent"]).optional(),
  notes: z.string().optional(),
});

type UnifiedFormData = z.infer<typeof unifiedFormSchema>;

interface Shipment {
  id: string;
  referenceNumber: string;
  bookingNumber: string;
  masterBillOfLading: string;
  shipper: string;
  consignee: string;
  originPort: string;
  destinationPort: string;
  etd?: string;
  eta?: string;
  carrier: string;
  vesselName?: string;
}

export default function AddContainer() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  // Extract shipmentId from URL query params
  const params = new URLSearchParams(window.location.search);
  const existingShipmentId = params.get("shipmentId");

  // Fetch existing shipment if shipmentId is provided
  const { data: existingShipment } = useQuery<Shipment>({
    queryKey: ["/api/shipments", existingShipmentId],
    enabled: !!existingShipmentId,
  });

  const form = useForm<UnifiedFormData>({
    resolver: zodResolver(unifiedFormSchema),
    defaultValues: {
      referenceNumber: "",
      bookingNumber: "",
      masterBillOfLading: "",
      shipper: "",
      consignee: "",
      originPort: "",
      destinationPort: "",
      shipmentEtd: "",
      shipmentEta: "",
      shipmentCarrier: "",
      shipmentVesselName: "",
      containerNumber: "",
      containerType: "40HC",
      status: "booking-confirmed",
      voyageNumber: "",
      bookingReference: "",
      sealNumber: "",
      weight: 0,
      containerEta: "",
      ata: "",
      lastFreeDay: "",
      podTerminal: "",
      holdTypes: [],
      customsStatus: "pending",
      riskLevel: "medium",
      priorityLevel: "normal",
      notes: "",
    },
  });

  // Pre-populate form with existing shipment data
  useEffect(() => {
    if (existingShipment) {
      form.setValue("referenceNumber", existingShipment.referenceNumber || "");
      form.setValue("bookingNumber", existingShipment.bookingNumber || "");
      form.setValue("masterBillOfLading", existingShipment.masterBillOfLading || "");
      form.setValue("shipper", existingShipment.shipper || "");
      form.setValue("consignee", existingShipment.consignee || "");
      form.setValue("originPort", existingShipment.originPort || "");
      form.setValue("destinationPort", existingShipment.destinationPort || "");
      form.setValue("shipmentEtd", existingShipment.etd || "");
      form.setValue("shipmentEta", existingShipment.eta || "");
      form.setValue("shipmentCarrier", existingShipment.carrier || "");
      form.setValue("shipmentVesselName", existingShipment.vesselName || "");
    }
  }, [existingShipment, form]);

  const createShipmentAndContainerMutation = useMutation({
    mutationFn: async (data: UnifiedFormData) => {
      let shipmentId = existingShipmentId;

      // Step 1: Create shipment only if not adding to existing
      if (!existingShipmentId) {
        const shipmentData = {
          referenceNumber: data.referenceNumber,
          bookingNumber: data.bookingNumber,
          masterBillOfLading: data.masterBillOfLading,
          shipper: data.shipper,
          consignee: data.consignee,
          originPort: data.originPort,
          destinationPort: data.destinationPort,
          etd: data.shipmentEtd,
          eta: data.shipmentEta,
          carrier: data.shipmentCarrier,
          vesselName: data.shipmentVesselName,
        };

        const shipment = await apiRequest("POST", "/api/shipments", shipmentData) as any;
        shipmentId = shipment.id;
      }

      // Step 2: Create container linked to shipment
      const containerData = {
        shipmentId,
        containerNumber: data.containerNumber,
        containerType: data.containerType,
        status: data.status,
        origin: data.originPort,
        destination: data.destinationPort,
        carrier: data.shipmentCarrier,
        vesselName: data.shipmentVesselName,
        voyageNumber: data.voyageNumber,
        bookingReference: data.bookingReference,
        masterBillOfLading: data.masterBillOfLading,
        sealNumber: data.sealNumber,
        weight: data.weight || 0,
        eta: data.containerEta,
        ata: data.ata,
        lastFreeDay: data.lastFreeDay,
        podTerminal: data.podTerminal,
        holdTypes: data.holdTypes,
        customsStatus: data.customsStatus || "pending",
        riskLevel: data.riskLevel,
        priorityLevel: data.priorityLevel,
        notes: data.notes,
        demurrageDays: 0,
        demurrageCharges: "0",
        isUrgent: data.priorityLevel === "urgent",
        hasException: false,
        isOverdue: false,
      };

      const response = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ container: containerData }),
      });

      if (!response.ok) {
        throw new Error("Failed to create container");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", existingShipmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      toast({
        title: existingShipmentId ? "Container Added" : "Shipment and Container Created",
        description: existingShipmentId 
          ? "The container has been added to the shipment successfully."
          : "The shipment and container have been added successfully.",
      });
      
      // Navigate to shipment detail if adding to existing, otherwise go to home
      if (existingShipmentId) {
        navigate(`/shipments/${existingShipmentId}`);
      } else {
        navigate("/");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error Creating Shipment/Container",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: UnifiedFormData) {
    createShipmentAndContainerMutation.mutate(data);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {existingShipmentId ? "Add Container to Shipment" : "Add Shipment & Container"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {existingShipmentId 
              ? `Adding container to shipment ${existingShipment?.referenceNumber || ""}` 
              : "Create a new shipment with container details"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* SHIPMENT INFORMATION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Shipment Information
              </CardTitle>
              <CardDescription>
                {existingShipmentId 
                  ? "Shipment details (read-only)" 
                  : "Enter the shipment details"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="referenceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., SHP-2024-001" 
                        data-testid="input-reference-number"
                        disabled={!!existingShipmentId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bookingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking Number *</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., BKG123456" 
                        data-testid="input-booking-number"
                        disabled={!!existingShipmentId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="masterBillOfLading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Master Bill of Lading *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., BOL789012" data-testid="input-bill-of-lading" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipper"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shipper *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., ABC Corporation" data-testid="input-shipper" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignee *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., XYZ Company" data-testid="input-consignee" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="originPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin Port *</FormLabel>
                    <FormControl>
                      <PortCombobox 
                        value={field.value} 
                        onChange={field.onChange}
                        placeholder="Select origin port"
                        testId="combobox-origin-port"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="destinationPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination Port (USA) *</FormLabel>
                    <FormControl>
                      <PortCombobox 
                        value={field.value} 
                        onChange={field.onChange}
                        placeholder="Select US destination port"
                        testId="combobox-destination-port"
                        usaOnly={true}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipmentCarrier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carrier *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Maersk Line (MAEU)" data-testid="input-carrier" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipmentVesselName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Maersk Antares" data-testid="input-vessel-name" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipmentEtd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ETD (Estimated Time of Departure)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-shipment-etd" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="shipmentEta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ETA (Estimated Time of Arrival)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-shipment-eta" disabled={!!existingShipmentId} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* CONTAINER INFORMATION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Container Information
              </CardTitle>
              <CardDescription>Enter the container details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="containerNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container Number *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., MAEU1234567" data-testid="input-container-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="containerType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-container-type">
                          <SelectValue placeholder="Select container type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="40HC">40HC (40ft High Cube)</SelectItem>
                        <SelectItem value="40GP">40GP (40ft General Purpose)</SelectItem>
                        <SelectItem value="20GP">20GP (20ft General Purpose)</SelectItem>
                        <SelectItem value="20HC">20HC (20ft High Cube)</SelectItem>
                        <SelectItem value="45HC">45HC (45ft High Cube)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="booking-confirmed">Booking Confirmed</SelectItem>
                        <SelectItem value="gate-in">Gate In</SelectItem>
                        <SelectItem value="loaded">Loaded on Vessel</SelectItem>
                        <SelectItem value="departed">Departed</SelectItem>
                        <SelectItem value="in-transit">In Transit</SelectItem>
                        <SelectItem value="arrived">Arrived at Port</SelectItem>
                        <SelectItem value="unloaded">Unloaded</SelectItem>
                        <SelectItem value="at-terminal">At Terminal</SelectItem>
                        <SelectItem value="customs-clearance">Customs Clearance</SelectItem>
                        <SelectItem value="gate-out">Gate Out</SelectItem>
                        <SelectItem value="on-rail">On Rail</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="delayed">Delayed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="voyageNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voyage Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., 123E" data-testid="input-voyage-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bookingReference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking Reference</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., BKG456789" data-testid="input-booking-reference" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sealNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seal Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., SEAL123456" data-testid="input-seal-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} placeholder="e.g., 24000" data-testid="input-weight" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="containerEta"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container ETA</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-container-eta" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ata"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ATA (Actual Time of Arrival)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-ata" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastFreeDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Free Day</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-last-free-day" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="podTerminal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>POD Terminal</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., LBCT (Long Beach Container Terminal)" data-testid="input-pod-terminal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customsStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customs Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-customs-status">
                          <SelectValue placeholder="Select customs status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="cleared">Cleared</SelectItem>
                        <SelectItem value="hold">On Hold</SelectItem>
                        <SelectItem value="inspection">Under Inspection</SelectItem>
                        <SelectItem value="released">Released</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="riskLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-risk-level">
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priorityLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority Level</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-priority-level">
                          <SelectValue placeholder="Select priority level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="holdTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Hold Types (Optional)
                      </FormLabel>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="freight-hold"
                            checked={field.value?.includes("Freight Hold")}
                            onCheckedChange={(checked) => {
                              const holds = field.value || [];
                              if (checked) {
                                field.onChange([...holds, "Freight Hold"]);
                              } else {
                                field.onChange(holds.filter(h => h !== "Freight Hold"));
                              }
                            }}
                            data-testid="checkbox-freight-hold"
                          />
                          <Label htmlFor="freight-hold" className="text-sm font-normal cursor-pointer">
                            Freight Hold <span className="text-muted-foreground">(Freight unpaid)</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="customs-hold"
                            checked={field.value?.includes("Customs Hold")}
                            onCheckedChange={(checked) => {
                              const holds = field.value || [];
                              if (checked) {
                                field.onChange([...holds, "Customs Hold"]);
                              } else {
                                field.onChange(holds.filter(h => h !== "Customs Hold"));
                              }
                            }}
                            data-testid="checkbox-customs-hold"
                          />
                          <Label htmlFor="customs-hold" className="text-sm font-normal cursor-pointer">
                            Customs Hold <span className="text-muted-foreground">(Inspection/clearance)</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="terminal-hold"
                            checked={field.value?.includes("Terminal Hold")}
                            onCheckedChange={(checked) => {
                              const holds = field.value || [];
                              if (checked) {
                                field.onChange([...holds, "Terminal Hold"]);
                              } else {
                                field.onChange(holds.filter(h => h !== "Terminal Hold"));
                              }
                            }}
                            data-testid="checkbox-terminal-hold"
                          />
                          <Label htmlFor="terminal-hold" className="text-sm font-normal cursor-pointer">
                            Terminal Hold <span className="text-muted-foreground">(Terminal restriction)</span>
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="other-hold"
                            checked={field.value?.includes("Other Hold")}
                            onCheckedChange={(checked) => {
                              const holds = field.value || [];
                              if (checked) {
                                field.onChange([...holds, "Other Hold"]);
                              } else {
                                field.onChange(holds.filter(h => h !== "Other Hold"));
                              }
                            }}
                            data-testid="checkbox-other-hold"
                          />
                          <Label htmlFor="other-hold" className="text-sm font-normal cursor-pointer">
                            Other Hold <span className="text-muted-foreground">(Miscellaneous)</span>
                          </Label>
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-2">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Any additional notes or comments..." rows={3} data-testid="input-notes" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/")}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createShipmentAndContainerMutation.isPending}
              data-testid="button-submit"
            >
              {createShipmentAndContainerMutation.isPending ? "Creating..." : "Create Shipment & Container"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
