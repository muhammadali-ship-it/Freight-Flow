import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertShipmentSchema } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Ship, Package, AlertTriangle, FileText, Users, MapPin, Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { OrganizationCombobox } from "@/components/organization-combobox";
import { PortCombobox } from "@/components/port-combobox";
import { CreatableCombobox } from "@/components/creatable-combobox";

const containerSchema = z.object({
  containerNumber: z.string().optional(),
  containerType: z.string().optional(),
  containerStatus: z.enum([
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
  ]).optional(),
  voyageNumber: z.string().optional(),
  bookingReference: z.string().optional(),
  sealNumber: z.string().optional(),
  weight: z.coerce.number().optional(),
  containerEta: z.string().optional(),
  containerAta: z.string().optional(),
  lastFreeDay: z.string().optional(),
  dailyFeeRate: z.coerce.number().min(0).optional(),
  detentionFee: z.coerce.number().min(0).optional(),
  exceptionCost: z.coerce.number().min(0).optional(),
  pickupChassis: z.string().optional(),
  yardLocation: z.string().optional(),
  pickupAppointment: z.string().optional(),
  podTerminal: z.string().optional(),
  holdTypes: z.array(z.string()).optional(),
  customsStatus: z.enum(["pending", "cleared", "hold", "inspection", "released"]).optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  priorityLevel: z.enum(["normal", "high", "urgent"]).optional(),
  terminalName: z.string().optional(),
  terminalLastFreeDay: z.string().optional(),
  terminalDemurrage: z.coerce.number().min(0).optional(),
  terminalPort: z.string().optional(),
  terminalAvailableForPickup: z.boolean().optional(),
  terminalFullOut: z.string().optional(),
  terminalOnRail: z.string().optional(),
  terminalPickupAppointment: z.string().optional(),
  terminalYardLocation: z.string().optional(),
  terminalPickupChassis: z.string().optional(),
  terminalEmptyReturned: z.string().optional(),
  railNumber: z.string().optional(),
  podRailCarrier: z.string().optional(),
  destinationRailCarrier: z.string().optional(),
  railLoaded: z.string().optional(),
  railDeparted: z.string().optional(),
  railArrived: z.string().optional(),
  railUnloaded: z.string().optional(),
  arrivedAtDestination: z.string().optional(),
  railFullOut: z.string().optional(),
  railEmptyReturned: z.string().optional(),
  railAvailable: z.boolean().optional(),
  estimatedArrivalAtFinalDestination: z.string().optional(),
  railLfd: z.string().optional(),
});

const milestoneSchema = z.object({
  type: z.string(),
  location: z.string().optional(),
  plannedTimestamp: z.string().optional(),
  actualTimestamp: z.string().optional(),
});

const formSchema = z.object({
  // Only MBL is required
  masterBillOfLading: z.string().min(1, "Master Bill of Lading is required"),
  
  // All other shipment fields are optional
  referenceNumber: z.string().optional(),
  bookingNumber: z.string().optional(),
  originPort: z.string().optional(),
  destinationPort: z.string().optional(),
  status: z.string().optional(),
  etd: z.string().optional(),
  eta: z.string().optional(),
  atd: z.string().optional(),
  ata: z.string().optional(),
  carrier: z.string().optional(),
  vesselName: z.string().optional(),
  shipper: z.string().optional(),
  consignee: z.string().optional(),
  shipperId: z.string().optional(),
  consigneeId: z.string().optional(),
  
  // Containers are optional
  containers: z.array(containerSchema).optional(),
  
  // Milestones are optional
  milestones: z.array(milestoneSchema).optional(),
});

type FormData = z.infer<typeof formSchema>;

// Common milestone types (matching Terminal 49 style)
const MILESTONE_TYPES = [
  { value: "EMPTY_IN", label: "Empty In (est.)" },
  { value: "FULL_OUT", label: "Full Out (est.)" },
  { value: "VESSEL_ARRIVED", label: "Vessel Arrived (est.)" },
  { value: "VESSEL_DEPARTED", label: "Vessel Departed" },
  { value: "VESSEL_LOADED", label: "Vessel Loaded" },
  { value: "RAIL_LOADED", label: "Rail Loaded" },
  { value: "RAIL_UNLOADED", label: "Rail Unloaded" },
  { value: "FULL_IN", label: "Full In" },
  { value: "EMPTY_OUT", label: "Empty Out" },
  { value: "GATE_OUT", label: "Gate Out" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CLEARED", label: "Customs Cleared" },
  { value: "POD_NEEDS_ATTENTION", label: "POD needs Attention" },
  { value: "POD_AWAITING_FULL_OUT", label: "POD awaiting Full Out" },
  { value: "POD_FULL_OUT", label: "POD Full Out" },
  { value: "EMPTY_RETURNED", label: "Empty Returned" },
];

// Major carriers (consolidated, no duplicates)
const CARRIERS = [
  { value: "Maersk Line" },
  { value: "MSC (Mediterranean Shipping Company)" },
  { value: "COSCO Shipping Lines" },
  { value: "Hapag-Lloyd" },
  { value: "CMA CGM" },
  { value: "Ocean Network Express (ONE)" },
  { value: "Evergreen Marine" },
  { value: "Yang Ming Marine Transport" },
  { value: "Hyundai Merchant Marine (HMM)" },
  { value: "Pacific International Lines (PIL)" },
  { value: "Wan Hai Lines" },
  { value: "ZIM Integrated Shipping Services" },
  { value: "Mitsui O.S.K. Lines (MOL)" },
  { value: "X-Press Feeders" },
  { value: "Orient Overseas Container Line (OOCL)" },
  { value: "The Shipping Corporation of India" },
  { value: "Atlantic Container Line (ACL)" },
  { value: "Matson Navigation" },
];

// Port to Terminals mapping for USA ports
const PORT_TERMINALS: Record<string, string[]> = {
  "Los Angeles, CA, USA": [
    "APMT Los Angeles",
    "Everport Terminal",
    "TraPac Terminal",
    "Yusen Terminal",
    "ITS Terminal",
    "West Basin Container Terminal",
  ],
  "Long Beach, CA, USA": [
    "LBCT (Long Beach Container Terminal)",
    "TTI Terminal",
    "ITS Long Beach",
    "PCT (Pier T)",
    "SSA Terminals",
  ],
  "New York, NY, USA": [
    "Maher Terminal",
    "APM Terminal",
    "GCT New York",
    "Red Hook Terminal",
  ],
  "Newark, NJ, USA": [
    "PNCT (Port Newark Container Terminal)",
    "APM Terminals Elizabeth",
    "Maher Terminals",
    "GCT New York (Newark Bay)",
  ],
  "Elizabeth, NJ, USA": [
    "APM Terminals Elizabeth",
    "Maher Terminals Elizabeth",
  ],
  "Oakland, CA, USA": [
    "SSA Oakland",
    "LBCT Oakland",
    "TraPac Oakland",
    "Matson Oakland",
  ],
  "Seattle, WA, USA": [
    "SSA Seattle",
    "TOTE Terminal",
    "Husky Terminal",
    "Terminal 18",
    "Terminal 5",
  ],
  "Tacoma, WA, USA": [
    "Husky Terminal",
    "Washington United Terminals (WUT)",
    "Pierce County Terminal (PCT)",
  ],
  "Houston, TX, USA": [
    "Barbours Cut Terminal",
    "Bayport Container Terminal",
  ],
  "Miami, FL, USA": [
    "PortMiami Seaboard Terminal",
    "South Florida Container Terminal",
  ],
  "Savannah, GA, USA": [
    "GPA Garden City Terminal",
    "Ocean Terminal",
    "Colonel's Island Terminal",
  ],
  "Charleston, SC, USA": [
    "Wando Welch Terminal",
    "North Charleston Terminal",
    "Columbus Street Terminal",
  ],
  "Norfolk, VA, USA": [
    "VIG (Virginia International Gateway)",
    "NIT (Norfolk International Terminals)",
    "Portsmouth Marine Terminal",
  ],
  "Baltimore, MD, USA": [
    "Seagirt Marine Terminal",
    "Dundalk Marine Terminal",
  ],
};

export default function ShipmentForm() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const params = useParams();
  const shipmentId = params.id;
  const isEditMode = !!shipmentId;

  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([]);
  const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);

  const { data: allUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: existingShipment, isLoading: isLoadingShipment } = useQuery({
    queryKey: ["/api/shipments", shipmentId],
    queryFn: async () => {
      if (!shipmentId) return null;
      const response = await fetch(`/api/shipments/${shipmentId}`);
      if (!response.ok) throw new Error("Failed to fetch shipment");
      return response.json();
    },
    enabled: isEditMode,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      referenceNumber: "",
      bookingNumber: "",
      masterBillOfLading: "",
      carrier: "",
      vesselName: "",
      shipper: "",
      consignee: "",
      shipperId: "",
      consigneeId: "",
      originPort: "",
      destinationPort: "",
      etd: "",
      eta: "",
      atd: "",
      ata: "",
      status: "planned",
      containers: [{
        containerNumber: "",
        containerType: "40HC",
        containerStatus: "booking-confirmed",
        voyageNumber: "",
        bookingReference: "",
        sealNumber: "",
        weight: 0,
        containerEta: "",
        containerAta: "",
        lastFreeDay: "",
        dailyFeeRate: 150,
        detentionFee: 0,
        exceptionCost: 0,
        pickupChassis: "",
        yardLocation: "",
        pickupAppointment: "",
        podTerminal: "",
        holdTypes: [],
        customsStatus: "pending",
        riskLevel: "medium",
        priorityLevel: "normal",
        terminalName: "",
        terminalLastFreeDay: "",
        terminalDemurrage: 0,
        terminalPort: "",
        terminalAvailableForPickup: false,
        terminalFullOut: "",
        terminalOnRail: "",
        terminalPickupAppointment: "",
        terminalYardLocation: "",
        terminalPickupChassis: "",
        terminalEmptyReturned: "",
        railNumber: "",
        podRailCarrier: "",
        destinationRailCarrier: "",
        railLoaded: "",
        railDeparted: "",
        railArrived: "",
        railUnloaded: "",
        arrivedAtDestination: "",
        railFullOut: "",
        railEmptyReturned: "",
        railAvailable: false,
        estimatedArrivalAtFinalDestination: "",
        railLfd: "",
      }],
    },
  });

  useEffect(() => {
    if (existingShipment && isEditMode) {
      form.reset({
        referenceNumber: existingShipment.referenceNumber || "",
        bookingNumber: existingShipment.bookingNumber || "",
        masterBillOfLading: existingShipment.masterBillOfLading || "",
        carrier: existingShipment.carrier || "",
        vesselName: existingShipment.vesselName || "",
        shipper: existingShipment.shipper || "",
        consignee: existingShipment.consignee || "",
        shipperId: (existingShipment as any).shipperId || "",
        consigneeId: (existingShipment as any).consigneeId || "",
        originPort: existingShipment.originPort || "",
        destinationPort: existingShipment.destinationPort || "",
        etd: existingShipment.etd || "",
        eta: existingShipment.eta || "",
        atd: existingShipment.atd || "",
        ata: existingShipment.ata || "",
        status: existingShipment.status || "planned",
        containers: [{
          containerNumber: "",
          containerType: "40HC",
          containerStatus: "booking-confirmed",
          voyageNumber: "",
          bookingReference: "",
          sealNumber: "",
          weight: 0,
          containerEta: "",
          containerAta: "",
          lastFreeDay: "",
          dailyFeeRate: 150,
          detentionFee: 0,
          exceptionCost: 0,
          pickupChassis: "",
          yardLocation: "",
          pickupAppointment: "",
          podTerminal: "",
          holdTypes: [],
          customsStatus: "pending",
          riskLevel: "medium",
          priorityLevel: "normal",
          terminalName: "",
          terminalLastFreeDay: "",
          terminalDemurrage: 0,
          terminalPort: "",
          terminalAvailableForPickup: false,
          terminalFullOut: "",
          terminalOnRail: "",
          terminalPickupAppointment: "",
          terminalYardLocation: "",
          terminalPickupChassis: "",
          terminalEmptyReturned: "",
          railNumber: "",
          podRailCarrier: "",
          destinationRailCarrier: "",
          railLoaded: "",
          railDeparted: "",
          railArrived: "",
          railUnloaded: "",
          arrivedAtDestination: "",
          railFullOut: "",
          railEmptyReturned: "",
          railAvailable: false,
          estimatedArrivalAtFinalDestination: "",
          railLfd: "",
        }],
      });
      const userIds = existingShipment.assignedUsers?.map((u: any) => u.id) || [];
      setAssignedUserIds(userIds);
    }
  }, [existingShipment, isEditMode, form]);

  // Functions to add/remove containers
  const addContainer = () => {
    const currentContainers = form.getValues("containers") || [];
    
    form.setValue("containers", [...currentContainers, {
      containerNumber: "",
      containerType: "40HC",
      containerStatus: "booking-confirmed",
      voyageNumber: "",
      bookingReference: "",
      sealNumber: "",
      weight: 0,
      containerEta: "",
      containerAta: "",
      lastFreeDay: "",
      dailyFeeRate: 150,
      detentionFee: 0,
      exceptionCost: 0,
      pickupChassis: "",
      yardLocation: "",
      pickupAppointment: "",
      podTerminal: "",
      holdTypes: [],
      customsStatus: "pending",
      riskLevel: "medium",
      priorityLevel: "normal",
      terminalName: "",
      terminalLastFreeDay: "",
      terminalDemurrage: 0,
      terminalPort: "",
      terminalAvailableForPickup: false,
      terminalFullOut: "",
      terminalOnRail: "",
      terminalPickupAppointment: "",
      terminalYardLocation: "",
      terminalPickupChassis: "",
      terminalEmptyReturned: "",
      railNumber: "",
      podRailCarrier: "",
      destinationRailCarrier: "",
      railLoaded: "",
      railDeparted: "",
      railArrived: "",
      railUnloaded: "",
      arrivedAtDestination: "",
      railFullOut: "",
      railEmptyReturned: "",
      railAvailable: false,
      estimatedArrivalAtFinalDestination: "",
      railLfd: "",
    }]);
  };

  const removeContainer = (index: number) => {
    const currentContainers = form.getValues("containers") || [];
    if (currentContainers.length > 1) {
      form.setValue("containers", currentContainers.filter((_, i) => i !== index));
    }
  };

  // Toggle milestone selection
  const toggleMilestone = (milestoneType: string) => {
    setSelectedMilestones(prev => {
      if (prev.includes(milestoneType)) {
        // Remove milestone
        const newMilestones = (form.getValues("milestones") || []).filter(m => m.type !== milestoneType);
        form.setValue("milestones", newMilestones);
        return prev.filter(m => m !== milestoneType);
      } else {
        // Add milestone
        const currentMilestones = form.getValues("milestones") || [];
        form.setValue("milestones", [...currentMilestones, {
          type: milestoneType,
          location: "",
          plannedTimestamp: "",
          actualTimestamp: "",
        }]);
        return [...prev, milestoneType];
      }
    });
  };

  // Watch destination port and get available terminals (show all terminals)
  const destinationPort = form.watch("destinationPort");
  const availableTerminals = Object.values(PORT_TERMINALS).flat();

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Step 1: Create shipment
      const shipmentData = {
        referenceNumber: data.referenceNumber,
        bookingNumber: data.bookingNumber,
        masterBillOfLading: data.masterBillOfLading,
        carrier: data.carrier,
        vesselName: data.vesselName || undefined,
        shipper: data.shipper,
        consignee: data.consignee,
        shipperId: data.shipperId || undefined,
        consigneeId: data.consigneeId || undefined,
        originPort: data.originPort,
        destinationPort: data.destinationPort,
        etd: data.etd || undefined,
        eta: data.eta || undefined,
        atd: data.atd || undefined,
        ata: data.ata || undefined,
        status: data.status,
      };

      const shipmentResponse = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipmentData),
      });
      if (!shipmentResponse.ok) throw new Error("Failed to create shipment");
      const shipment = await shipmentResponse.json();

      // Step 2: Create milestones if any
      if (data.milestones && data.milestones.length > 0) {
        for (const milestoneInfo of data.milestones) {
          if (milestoneInfo.type) {
            const milestoneData = {
              shipmentId: shipment.id,
              type: milestoneInfo.type,
              location: milestoneInfo.location || "",
              plannedTimestamp: milestoneInfo.plannedTimestamp || null,
              actualTimestamp: milestoneInfo.actualTimestamp || null,
              status: milestoneInfo.actualTimestamp ? "completed" : "pending",
            };

            const milestoneResponse = await fetch("/api/milestones", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(milestoneData),
            });
            if (!milestoneResponse.ok) throw new Error("Failed to create milestone");
          }
        }
      }

      // Step 3: Create all containers linked to shipment (if any)
      if (data.containers && data.containers.length > 0) {
        for (const containerInfo of data.containers) {
          // Build rail data object
          const railData: any = {};
          if (containerInfo.railNumber) railData.railNumber = containerInfo.railNumber;
          if (containerInfo.podRailCarrier) railData.podRailCarrier = containerInfo.podRailCarrier;
          if (containerInfo.destinationRailCarrier) railData.destinationRailCarrier = containerInfo.destinationRailCarrier;
          if (containerInfo.railLoaded) railData.railLoaded = containerInfo.railLoaded;
          if (containerInfo.railDeparted) railData.railDeparted = containerInfo.railDeparted;
          if (containerInfo.railArrived) railData.railArrived = containerInfo.railArrived;
          if (containerInfo.railUnloaded) railData.railUnloaded = containerInfo.railUnloaded;
          if (containerInfo.arrivedAtDestination) railData.arrivedAtDestination = containerInfo.arrivedAtDestination;
          if (containerInfo.railFullOut) railData.railFullOut = containerInfo.railFullOut;
          if (containerInfo.railEmptyReturned) railData.railEmptyReturned = containerInfo.railEmptyReturned;
          if (containerInfo.railAvailable !== undefined) railData.railAvailable = containerInfo.railAvailable;
          if (containerInfo.estimatedArrivalAtFinalDestination) railData.estimatedArrivalAtFinalDestination = containerInfo.estimatedArrivalAtFinalDestination;
          if (containerInfo.railLfd) railData.railLfd = containerInfo.railLfd;

          const containerData = {
            shipmentId: shipment.id,
            containerNumber: containerInfo.containerNumber,
            containerType: containerInfo.containerType,
            status: containerInfo.containerStatus || "pending",
            origin: data.originPort || "",
            destination: data.destinationPort || "",
            carrier: data.carrier || "",
            vesselName: data.vesselName || "",
            bookingNumber: containerInfo.bookingReference || "",
            masterBillOfLading: data.masterBillOfLading || "",
            weight: containerInfo.weight ? containerInfo.weight.toString() : "",
            volume: "",
            eta: containerInfo.containerEta || "",
            estimatedArrival: containerInfo.containerEta || "",
            progress: 0,
            lastFreeDay: containerInfo.lastFreeDay,
            dailyFeeRate: containerInfo.dailyFeeRate?.toString() || "150",
            detentionFee: containerInfo.detentionFee?.toString() || "0",
            pickupChassis: containerInfo.pickupChassis,
            yardLocation: containerInfo.yardLocation,
            pickupAppointment: containerInfo.pickupAppointment,
            podTerminal: containerInfo.podTerminal,
            holdTypes: containerInfo.holdTypes,
            riskLevel: containerInfo.riskLevel,
            rawData: Object.keys(railData).length > 0 ? railData : undefined,
          };

          const containerResponse = await fetch("/api/containers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ container: containerData }),
          });
          if (!containerResponse.ok) throw new Error("Failed to create container");
        }
      }

      // Step 4: Update shipment rawData with terminal information if provided
      if (data.containers?.[0]) {
        const container = data.containers[0];
        const terminalInfo: any = {};
        
        if (container.terminalName) terminalInfo.terminalName = container.terminalName;
        if (container.terminalPort) terminalInfo.terminalPort = container.terminalPort;
        if (container.terminalLastFreeDay) terminalInfo.lastFreeDay = container.terminalLastFreeDay;
        if (container.terminalDemurrage) terminalInfo.demurrage = container.terminalDemurrage;
        if (container.terminalYardLocation) terminalInfo.terminalYardLocation = container.terminalYardLocation;
        if (container.terminalPickupChassis) terminalInfo.terminalPickupChassis = container.terminalPickupChassis;
        if (container.terminalFullOut) terminalInfo.terminalFullOut = container.terminalFullOut;
        if (container.terminalOnRail) terminalInfo.terminalOnRail = container.terminalOnRail;
        if (container.terminalPickupAppointment) terminalInfo.terminalPickupAppointment = container.terminalPickupAppointment;
        if (container.terminalEmptyReturned) terminalInfo.terminalEmptyReturned = container.terminalEmptyReturned;
        if (container.terminalAvailableForPickup !== undefined) terminalInfo.terminalAvailableForPickup = container.terminalAvailableForPickup;
        
        if (Object.keys(terminalInfo).length > 0) {
          await fetch(`/api/shipments/${shipment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ 
              rawData: { ...shipment.rawData, ...terminalInfo }
            }),
          });
        }
      }

      return shipment;
    },
    onSuccess: async (shipment: any) => {
      if (assignedUserIds.length > 0) {
        await apiRequest("POST", `/api/shipments/${shipment.id}/users`, {
          userIds: assignedUserIds,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      toast({
        title: "Shipment & Containers Created",
        description: "The shipment and containers have been created successfully. It will be posted to Cargoes Flow and tracked automatically.",
      });
      navigate(`/shipments/${shipment.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating shipment/container",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch(`/api/shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceNumber: data.referenceNumber,
          bookingNumber: data.bookingNumber,
          masterBillOfLading: data.masterBillOfLading,
          carrier: data.carrier,
          vesselName: data.vesselName || undefined,
          shipper: data.shipper,
          consignee: data.consignee,
          shipperId: data.shipperId || undefined,
          consigneeId: data.consigneeId || undefined,
          originPort: data.originPort,
          destinationPort: data.destinationPort,
          etd: data.etd || undefined,
          eta: data.eta || undefined,
          atd: data.atd || undefined,
          ata: data.ata || undefined,
          status: data.status,
        }),
      });
      if (!response.ok) throw new Error("Failed to update shipment");
      return response.json();
    },
    onSuccess: async (shipment: any) => {
      await apiRequest("POST", `/api/shipments/${shipmentId}/users`, {
        userIds: assignedUserIds,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments", shipmentId] });
      toast({
        title: "Shipment updated",
        description: "The shipment has been updated successfully.",
      });
      navigate(`/shipments/${shipment.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating shipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: FormData) {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  }

  const handleToggleUser = (userId: string) => {
    setAssignedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditMode && isLoadingShipment) {
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
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Loading...</h1>
          </div>
        </div>
      </div>
    );
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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="heading-form">
            {isEditMode ? "Edit Shipment" : "Add Shipment & Container"}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {isEditMode ? "Update shipment details" : "Create a new shipment with container"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* SHIPMENT INFORMATION */}
          {!isEditMode && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Shipment Information
              </CardTitle>
              <CardDescription>Basic shipment identification</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="referenceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference Number</FormLabel>
                    <FormControl>
                      <Input placeholder="REF-2024-001" {...field} data-testid="input-reference-number" />
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
                      <Input placeholder="BL123456789" {...field} data-testid="input-bill-of-lading" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          )}

          {/* MILESTONE EVENTS */}
          <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Milestone Events
                </CardTitle>
                <CardDescription>Select milestone events to track for this shipment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Milestone Checkboxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MILESTONE_TYPES.map((milestone) => (
                    <div key={milestone.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`milestone-${milestone.value}`}
                        checked={selectedMilestones.includes(milestone.value)}
                        onCheckedChange={() => toggleMilestone(milestone.value)}
                        data-testid={`checkbox-milestone-${milestone.value.toLowerCase()}`}
                      />
                      <Label
                        htmlFor={`milestone-${milestone.value}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {milestone.label}
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Milestone Details */}
                {selectedMilestones.length > 0 && (
                  <div className="mt-6 space-y-6 pt-4 border-t">
                    <h4 className="text-sm font-medium">Milestone Details</h4>
                    {selectedMilestones.map((milestoneType, index) => {
                      const milestone = MILESTONE_TYPES.find(m => m.value === milestoneType);
                      const milestoneIndex = (form.watch("milestones") || []).findIndex(m => m.type === milestoneType);
                      
                      return (
                        <Card key={milestoneType} className="p-4">
                          <h5 className="text-sm font-medium mb-3">{milestone?.label}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <FormField
                              control={form.control}
                              name={`milestones.${milestoneIndex}.location` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Location</FormLabel>
                                  <FormControl>
                                    <Input 
                                      {...field} 
                                      placeholder="e.g., Haiphong (VNHPH)" 
                                      data-testid={`input-milestone-location-${milestoneType.toLowerCase()}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`milestones.${milestoneIndex}.plannedTimestamp` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Estimated Time</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="datetime-local" 
                                      {...field} 
                                      data-testid={`input-milestone-planned-${milestoneType.toLowerCase()}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name={`milestones.${milestoneIndex}.actualTimestamp` as any}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Actual Time</FormLabel>
                                  <FormControl>
                                    <Input 
                                      type="datetime-local" 
                                      {...field} 
                                      data-testid={`input-milestone-actual-${milestoneType.toLowerCase()}`}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          {/* CONTAINER INFORMATION */}
          <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Container Information ({form.watch("containers")?.length || 0})
                  </CardTitle>
                  <CardDescription>Container details for this shipment</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addContainer}
                  data-testid="button-add-container"
                >
                  <Package className="mr-2 h-4 w-4" />
                  Add Container
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="containers.0.containerNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., MAEU1234567" data-testid="input-container-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.containerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-container-type">
                            <SelectValue placeholder="Select type" />
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
                  name="containers.0.containerStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-container-status">
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
                  name="containers.0.voyageNumber"
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
                  name="containers.0.bookingReference"
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
                  name="containers.0.sealNumber"
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
                  name="containers.0.weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="e.g., 52910" data-testid="input-weight" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.containerEta"
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
                  name="containers.0.containerAta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Container ATA</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-container-ata" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.lastFreeDay"
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
                  name="containers.0.dailyFeeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Demurrage Rate ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} placeholder="150" data-testid="input-daily-fee-rate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.detentionFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detention Fee ($)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} placeholder="0" data-testid="input-detention-fee" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.pickupChassis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Chassis</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter chassis number" data-testid="input-pickup-chassis" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.yardLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yard Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter yard location" data-testid="input-yard-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.pickupAppointment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Appointment</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-pickup-appointment" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.podTerminal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>POD Terminal (All Terminals)</FormLabel>
                      <FormControl>
                        <CreatableCombobox
                          type="terminal"
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Select or create terminal"
                          testId="button-pod-terminal"
                          staticOptions={availableTerminals.map(t => ({ value: t }))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.customsStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customs Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customs-status">
                            <SelectValue placeholder="Select status" />
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
                  name="containers.0.riskLevel"
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
                  name="containers.0.priorityLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-priority-level">
                            <SelectValue placeholder="Select priority" />
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
                    name="containers.0.holdTypes"
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
              </CardContent>
            </Card>

          {/* TERMINAL INFORMATION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Terminal Information (Optional)
              </CardTitle>
              <CardDescription>Add terminal details including port, pickup status, and logistics information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="containers.0.terminalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Terminal Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., APM Terminals Elizabeth" data-testid="input-terminal-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Los Angeles" data-testid="input-terminal-port" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalYardLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Yard Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Block A, Row 12" data-testid="input-terminal-yard" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalPickupChassis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Chassis #</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., CH123456" data-testid="input-terminal-chassis" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalLastFreeDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Free Day (LFD)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-terminal-lfd" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalDemurrage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Demurrage Cost</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} placeholder="e.g., 150.00" data-testid="input-terminal-demurrage" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalFullOut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Out</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-terminal-full-out" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalOnRail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>On Rail</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-terminal-on-rail" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalPickupAppointment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pickup Appointment</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-terminal-pickup-apt" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalEmptyReturned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empty Returned</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-terminal-empty-returned" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.terminalAvailableForPickup"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-7">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-terminal-available"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-medium">
                          Available For Pickup
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* RAIL INFORMATION */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Rail Information (Optional)
              </CardTitle>
              <CardDescription>Add rail tracking and milestone information for this container</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="containers.0.railNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rail Number</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., RAIL123456" data-testid="input-rail-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.podRailCarrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>POD Rail Carrier</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Union Pacific" data-testid="input-pod-rail-carrier" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.destinationRailCarrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Rail Carrier</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., BNSF" data-testid="input-dest-rail-carrier" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />
              <h4 className="font-semibold text-sm">Rail Milestones</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="containers.0.railLoaded"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rail Loaded</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-rail-loaded" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railDeparted"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rail Departed</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-rail-departed" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railArrived"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rail Arrived</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-rail-arrived" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railUnloaded"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rail Unloaded</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-rail-unloaded" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.arrivedAtDestination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrived At Destination</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-arrived-at-dest" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railFullOut"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Out</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-rail-full-out" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railEmptyReturned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Empty Returned</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-rail-empty-returned" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.estimatedArrivalAtFinalDestination"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Est. Arrival at Final Destination</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-est-arrival-final" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railLfd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LFD (Last Free Day)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-rail-lfd" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="containers.0.railAvailable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-7">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-rail-available"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="font-medium">
                          Available
                        </FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* ASSIGNED USERS */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assigned Users
              </CardTitle>
              <CardDescription>Select users who can view and manage this shipment</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Search and Select Users</Label>
                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userSearchOpen}
                      className="w-full justify-between"
                      data-testid="button-select-users"
                    >
                      {assignedUserIds.length > 0
                        ? `${assignedUserIds.length} user(s) selected`
                        : "Search and select users..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search by username or role..." />
                      <CommandList>
                        <CommandEmpty>No user found.</CommandEmpty>
                        <CommandGroup>
                          {(allUsers as any)?.map((user: any) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.username} ${user.role}`}
                              onSelect={() => {
                                handleToggleUser(user.id);
                              }}
                              data-testid={`option-user-${user.id}`}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  assignedUserIds.includes(user.id) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">{user.username}</span>
                                <span className="text-sm text-muted-foreground">{user.role}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              {assignedUserIds.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Users:</Label>
                  <div className="flex flex-wrap gap-2">
                    {assignedUserIds.map((userId) => {
                      const user = (allUsers as any)?.find((u: any) => u.id === userId);
                      return user ? (
                        <div
                          key={userId}
                          className="flex items-center gap-2 px-3 py-1 bg-secondary text-secondary-foreground rounded-md text-sm"
                          data-testid={`selected-user-${userId}`}
                        >
                          <span>{user.username}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleUser(userId)}
                            className="hover:text-destructive"
                            data-testid={`remove-user-${userId}`}
                          >
                            ×
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => window.history.back()}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending ? "Saving..." : isEditMode ? "Update Shipment" : "Create Shipment & Container"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
