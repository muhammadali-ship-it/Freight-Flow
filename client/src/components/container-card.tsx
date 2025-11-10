import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, ContainerStatus } from "./status-badge";
import { ArrowRight, Eye, MapPin, Edit2, Check, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { RiskPriorityIndicator, RiskLevel } from "./risk-priority-indicator";
import { TerminalStatusBadge, TerminalStatus } from "./terminal-status-badge";
import { DemurrageAlert } from "./demurrage-alert";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const formatDateOnly = (dateString: string | undefined | null): string => {
  if (!dateString) return "—";
  // Extract just the date portion (YYYY-MM-DD) from datetime strings
  const match = dateString.match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateString;
};

interface ContainerCardProps {
  id: string;
  containerNumber: string;
  status: ContainerStatus;
  origin: string;
  destination: string;
  carrier: string;
  eta: string;
  progress: number;
  reference?: string;
  bookingNumber?: string;
  riskLevel?: RiskLevel;
  riskReason?: string;
  terminalStatus?: TerminalStatus;
  lastFreeDay?: string;
  dailyFeeRate?: string;
  demurrageFee?: number;
  detentionFee?: number;
  exceptionCost?: number;
  onViewDetails?: () => void;
}

export function ContainerCard({
  id,
  containerNumber,
  status,
  origin,
  destination,
  carrier,
  eta,
  progress,
  reference,
  bookingNumber,
  riskLevel,
  riskReason,
  terminalStatus,
  lastFreeDay,
  dailyFeeRate,
  demurrageFee,
  detentionFee,
  exceptionCost,
  onViewDetails,
}: ContainerCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedStatus, setEditedStatus] = useState(status);
  const [editedEta, setEditedEta] = useState(eta);
  const [editedTerminalStatus, setEditedTerminalStatus] = useState(terminalStatus || "none");
  const [editedReference, setEditedReference] = useState(reference || "");
  const [editedBookingNumber, setEditedBookingNumber] = useState(bookingNumber || "");
  const [editedLastFreeDay, setEditedLastFreeDay] = useState(lastFreeDay || "");
  const [editedDailyFeeRate, setEditedDailyFeeRate] = useState(dailyFeeRate || "150");
  const { toast } = useToast();

  const updateMutation = useMutation({
    mutationFn: async (data: { 
      status?: ContainerStatus; 
      eta?: string; 
      terminalStatus?: TerminalStatus | null;
      reference?: string;
      bookingNumber?: string;
      lastFreeDay?: string;
      dailyFeeRate?: string;
    }) => {
      return await apiRequest("PATCH", `/api/containers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      setIsEditing(false);
      toast({
        title: "Container updated",
        description: "Changes saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update failed",
        description: "Could not save changes",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates: { 
      status?: ContainerStatus; 
      eta?: string; 
      terminalStatus?: TerminalStatus | null;
      reference?: string;
      bookingNumber?: string;
      lastFreeDay?: string;
      dailyFeeRate?: string;
    } = {};
    
    if (editedStatus !== status) updates.status = editedStatus;
    if (editedEta !== eta) updates.eta = editedEta;
    if (editedTerminalStatus !== (terminalStatus || "none")) {
      updates.terminalStatus = (editedTerminalStatus === "none" ? null : editedTerminalStatus) as TerminalStatus | null;
    }
    if (editedReference !== (reference || "")) updates.reference = editedReference;
    if (editedBookingNumber !== (bookingNumber || "")) updates.bookingNumber = editedBookingNumber;
    if (editedLastFreeDay !== (lastFreeDay || "")) updates.lastFreeDay = editedLastFreeDay;
    if (editedDailyFeeRate !== (dailyFeeRate || "150")) updates.dailyFeeRate = editedDailyFeeRate;
    
    if (Object.keys(updates).length > 0) {
      updateMutation.mutate(updates);
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedStatus(status);
    setEditedEta(eta);
    setEditedTerminalStatus(terminalStatus || "none");
    setEditedReference(reference || "");
    setEditedBookingNumber(bookingNumber || "");
    setEditedLastFreeDay(lastFreeDay || "");
    setEditedDailyFeeRate(dailyFeeRate || "150");
    setIsEditing(false);
  };

  return (
    <Card className="hover-elevate" data-testid={`card-container-${containerNumber}`}>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1">
            <p className="font-mono text-base font-semibold" data-testid={`text-container-number-${containerNumber}`}>
              {containerNumber}
            </p>
            {!isEditing ? (
              reference && (
                <p className="text-xs text-muted-foreground">Ref: {reference}</p>
              )
            ) : (
              <Input
                type="text"
                value={editedReference}
                onChange={(e) => setEditedReference(e.target.value)}
                placeholder="Reference Number"
                className="h-6 text-xs mt-1"
                data-testid={`input-reference-${containerNumber}`}
              />
            )}
          </div>
          {!isEditing ? (
            <StatusBadge status={status} />
          ) : (
            <Select value={editedStatus} onValueChange={(value) => setEditedStatus(value as ContainerStatus)}>
              <SelectTrigger className="w-[130px] h-6 text-xs" data-testid={`select-status-${containerNumber}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in-transit">In Transit</SelectItem>
                <SelectItem value="at-port">At Port</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="delayed">Delayed</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
        {riskLevel && (
          <RiskPriorityIndicator level={riskLevel} reason={riskReason} />
        )}
        {!isEditing ? (
          terminalStatus && <TerminalStatusBadge status={terminalStatus} />
        ) : (
          <Select value={editedTerminalStatus} onValueChange={setEditedTerminalStatus}>
            <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-terminal-status-${containerNumber}`}>
              <SelectValue placeholder="No terminal status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="available">Available for Pickup</SelectItem>
              <SelectItem value="not-available">Not Available</SelectItem>
              <SelectItem value="pending">Pending Release</SelectItem>
              <SelectItem value="hold">Customs Hold</SelectItem>
              <SelectItem value="customs-hold">Customs Hold (Legacy)</SelectItem>
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {lastFreeDay && (
          <DemurrageAlert
            lastFreeDay={lastFreeDay}
            containerNumber={containerNumber}
            estimatedFees={demurrageFee}
          />
        )}
        {((demurrageFee && demurrageFee > 0) || (detentionFee && detentionFee > 0) || (exceptionCost && exceptionCost > 0)) && (
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Cost Summary</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {demurrageFee && demurrageFee > 0 && (
                <div>
                  <p className="text-muted-foreground">Demurrage</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">${demurrageFee.toLocaleString()}</p>
                </div>
              )}
              {detentionFee && detentionFee > 0 && (
                <div>
                  <p className="text-muted-foreground">Detention</p>
                  <p className="font-semibold text-orange-600 dark:text-orange-400">${detentionFee.toLocaleString()}</p>
                </div>
              )}
              {exceptionCost && exceptionCost > 0 && (
                <div>
                  <p className="text-muted-foreground">Exception</p>
                  <p className="font-semibold text-yellow-600 dark:text-yellow-400">${exceptionCost.toLocaleString()}</p>
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold">Total Cost</p>
                <p className="text-sm font-bold text-primary">
                  ${((demurrageFee || 0) + (detentionFee || 0) + (exceptionCost || 0)).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{origin}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{destination}</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">Carrier</p>
            <p className="font-medium mt-0.5">{carrier}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ETA</p>
            {!isEditing ? (
              <p className="font-medium mt-0.5">{formatDateOnly(eta)}</p>
            ) : (
              <Input
                type="text"
                value={editedEta}
                onChange={(e) => setEditedEta(e.target.value)}
                className="h-6 text-xs mt-0.5"
                data-testid={`input-eta-${containerNumber}`}
              />
            )}
          </div>
          {isEditing && (
            <>
              <div>
                <p className="text-muted-foreground">Booking Number</p>
                <Input
                  type="text"
                  value={editedBookingNumber}
                  onChange={(e) => setEditedBookingNumber(e.target.value)}
                  placeholder="Booking #"
                  className="h-6 text-xs mt-0.5"
                  data-testid={`input-booking-${containerNumber}`}
                />
              </div>
              <div>
                <p className="text-muted-foreground">Last Free Day</p>
                <Input
                  type="date"
                  value={editedLastFreeDay}
                  onChange={(e) => setEditedLastFreeDay(e.target.value)}
                  className="h-6 text-xs mt-0.5"
                  data-testid={`input-lfd-${containerNumber}`}
                />
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Daily Demurrage Rate ($)</p>
                <Input
                  type="number"
                  value={editedDailyFeeRate}
                  onChange={(e) => setEditedDailyFeeRate(e.target.value)}
                  placeholder="150"
                  className="h-6 text-xs mt-0.5"
                  data-testid={`input-daily-rate-${containerNumber}`}
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        {!isEditing ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={onViewDetails}
              data-testid={`button-view-details-${containerNumber}`}
            >
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </Button>
            <Button variant="ghost" size="sm" data-testid={`button-track-${containerNumber}`}>
              <MapPin className="mr-2 h-4 w-4" />
              Track
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              data-testid={`button-edit-${containerNumber}`}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="default"
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid={`button-save-${containerNumber}`}
            >
              <Check className="mr-2 h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
              data-testid={`button-cancel-${containerNumber}`}
            >
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
