import type { IntegrationConfig, CarrierUpdate, InsertCarrierUpdate } from "@shared/schema.js";

export interface ShippingLineData {
  containerNumber: string;
  status: string;
  location: string;
  timestamp: string;
  vesselName?: string;
  eta?: string;
  events?: Array<{
    type: string;
    location: string;
    timestamp: string;
    description: string;
  }>;
  rawData: any;
}

export abstract class ShippingLineAdapter {
  constructor(protected config: IntegrationConfig) {}

  abstract getName(): string;
  abstract fetchContainerData(containerNumber: string): Promise<ShippingLineData | null>;
  abstract fetchBulkUpdates(since?: Date): Promise<ShippingLineData[]>;
  abstract validateWebhook(payload: any, signature: string): boolean;
  abstract parseWebhook(payload: any): ShippingLineData[];

  public buildCarrierUpdate(data: ShippingLineData): Omit<InsertCarrierUpdate, "integrationId"> {
    return {
      containerNumber: data.containerNumber,
      carrier: this.config.carrier,
      updateType: this.determineUpdateType(data),
      status: data.status,
      location: data.location,
      timestamp: data.timestamp,
      rawData: data.rawData,
      processed: false,
    };
  }

  protected determineUpdateType(data: ShippingLineData): string {
    if (data.status.toLowerCase().includes("loaded") || data.status.toLowerCase().includes("departed")) {
      return "departure";
    }
    if (data.status.toLowerCase().includes("arrived") || data.status.toLowerCase().includes("discharged")) {
      return "arrival";
    }
    if (data.status.toLowerCase().includes("gate")) {
      return "gate";
    }
    if (data.status.toLowerCase().includes("customs")) {
      return "customs";
    }
    return "status_update";
  }

  protected async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    const apiKey = process.env[this.config.apiKeyName || ""];
    
    const headers = {
      "Content-Type": "application/json",
      ...(apiKey && { "Authorization": `Bearer ${apiKey}` }),
      ...options.headers,
    };

    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

export class MaerskAdapter extends ShippingLineAdapter {
  getName(): string {
    return "Maersk";
  }

  async fetchContainerData(containerNumber: string): Promise<ShippingLineData | null> {
    try {
      const url = `${this.config.apiEndpoint}/containers/${containerNumber}`;
      const data = await this.makeRequest(url);

      return {
        containerNumber: data.containerNumber || containerNumber,
        status: data.status || "Unknown",
        location: data.currentLocation || "Unknown",
        timestamp: data.lastUpdate || new Date().toISOString(),
        vesselName: data.vesselName,
        eta: data.estimatedTimeOfArrival,
        events: data.events,
        rawData: data,
      };
    } catch (error) {
      console.error(`Error fetching Maersk data for ${containerNumber}:`, error);
      return null;
    }
  }

  async fetchBulkUpdates(since?: Date): Promise<ShippingLineData[]> {
    try {
      const params = since ? `?since=${since.toISOString()}` : "";
      const url = `${this.config.apiEndpoint}/updates${params}`;
      const data = await this.makeRequest(url);

      return (data.containers || []).map((container: any) => ({
        containerNumber: container.containerNumber,
        status: container.status,
        location: container.currentLocation,
        timestamp: container.lastUpdate,
        vesselName: container.vesselName,
        eta: container.estimatedTimeOfArrival,
        events: container.events,
        rawData: container,
      }));
    } catch (error) {
      console.error("Error fetching Maersk bulk updates:", error);
      return [];
    }
  }

  validateWebhook(payload: any, signature: string): boolean {
    return true;
  }

  parseWebhook(payload: any): ShippingLineData[] {
    if (!payload.updates || !Array.isArray(payload.updates)) {
      return [];
    }

    return payload.updates.map((update: any) => ({
      containerNumber: update.containerNumber,
      status: update.status,
      location: update.location,
      timestamp: update.timestamp || new Date().toISOString(),
      vesselName: update.vesselName,
      eta: update.eta,
      rawData: update,
    }));
  }
}

export class MSCAdapter extends ShippingLineAdapter {
  getName(): string {
    return "MSC";
  }

  async fetchContainerData(containerNumber: string): Promise<ShippingLineData | null> {
    try {
      const url = `${this.config.apiEndpoint}/tracking/${containerNumber}`;
      const data = await this.makeRequest(url);

      return {
        containerNumber: data.container_number || containerNumber,
        status: data.current_status || "Unknown",
        location: data.location || "Unknown",
        timestamp: data.timestamp || new Date().toISOString(),
        vesselName: data.vessel,
        eta: data.eta,
        rawData: data,
      };
    } catch (error) {
      console.error(`Error fetching MSC data for ${containerNumber}:`, error);
      return null;
    }
  }

  async fetchBulkUpdates(since?: Date): Promise<ShippingLineData[]> {
    return [];
  }

  validateWebhook(payload: any, signature: string): boolean {
    return true;
  }

  parseWebhook(payload: any): ShippingLineData[] {
    if (!payload.containers) {
      return [];
    }

    return payload.containers.map((container: any) => ({
      containerNumber: container.container_number,
      status: container.status,
      location: container.location,
      timestamp: container.timestamp || new Date().toISOString(),
      vesselName: container.vessel,
      eta: container.eta,
      rawData: container,
    }));
  }
}

export class COSCOAdapter extends ShippingLineAdapter {
  getName(): string {
    return "COSCO";
  }

  async fetchContainerData(containerNumber: string): Promise<ShippingLineData | null> {
    try {
      const url = `${this.config.apiEndpoint}/api/v1/container/${containerNumber}`;
      const data = await this.makeRequest(url);

      return {
        containerNumber: data.cntrNo || containerNumber,
        status: data.cntrStatus || "Unknown",
        location: data.placeOfDelivery || "Unknown",
        timestamp: data.updateTime || new Date().toISOString(),
        vesselName: data.vesselName,
        eta: data.eta,
        rawData: data,
      };
    } catch (error) {
      console.error(`Error fetching COSCO data for ${containerNumber}:`, error);
      return null;
    }
  }

  async fetchBulkUpdates(since?: Date): Promise<ShippingLineData[]> {
    return [];
  }

  validateWebhook(payload: any, signature: string): boolean {
    return true;
  }

  parseWebhook(payload: any): ShippingLineData[] {
    return [];
  }
}

export function createShippingLineAdapter(config: IntegrationConfig): ShippingLineAdapter {
  const carrier = config.carrier.toUpperCase();
  
  switch (carrier) {
    case "MAERSK":
      return new MaerskAdapter(config);
    case "MSC":
      return new MSCAdapter(config);
    case "COSCO":
      return new COSCOAdapter(config);
    default:
      throw new Error(`Unsupported shipping line: ${config.carrier}`);
  }
}
