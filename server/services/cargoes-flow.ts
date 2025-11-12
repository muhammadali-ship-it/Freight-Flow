import { storage } from "../storage.js";

const CARGOES_FLOW_CREATE_API_URL = "https://connect.cargoes.com/flow/api/public_tracking/v1/createShipments";
const CARGOES_FLOW_UPDATE_API_URL = "https://connect.cargoes.com/flow/api/public_tracking/v1/updateShipments";
const CARGOES_FLOW_UPLOAD_DOCUMENT_API_URL = "https://connect.cargoes.com/flow/api/public_tracking/v1/uploadDocument";
const CARGOES_FLOW_API_KEY = "dL6SngaHRXZfvzGA716lioRD7ZsRC9hs";
const CARGOES_FLOW_ORG_TOKEN = "V904eqatVp49P7FZuwEtoFg72TJDyFnb";

interface CargoesFlowFormData {
  mblNumber: string;
  oceanLine?: string;
  shipmentReference?: string;
  bookingNumber?: string;
  consignee?: string;
  shipper?: string;
  promisedEta?: string;
  promisedEtd?: string;
  incoterm?: string;
}

interface CargoesFlowPayload {
  formData: CargoesFlowFormData[];
  uploadType: string;
}

export async function sendShipmentToCargoesFlow(
  shipmentReference: string,
  mblNumber: string,
  shipmentData?: any
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    console.log(`[Cargoes Flow] Sending shipment ${shipmentReference} (MBL: ${mblNumber})`);

    // Send ONLY the MBL number as requested
    const payload = {
      formData: [
        {
          mblNumber: mblNumber
        }
      ],
      uploadType: "FORM_BY_MBL_NUMBER"
    };

    console.log('[Cargoes Flow] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(CARGOES_FLOW_CREATE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DPW-ApiKey": CARGOES_FLOW_API_KEY,
        "X-DPW-Org-Token": CARGOES_FLOW_ORG_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[Cargoes Flow] Failed to send shipment:`, responseData);
      return { 
        success: false, 
        error: responseData.message || `HTTP ${response.status}`,
        response: responseData
      };
    }

    console.log(`[Cargoes Flow] ✅ Shipment sent successfully:`, responseData);
    return { success: true, response: responseData };
  } catch (error: any) {
    console.error(`[Cargoes Flow] Error sending shipment:`, error);
    return { success: false, error: error.message };
  }
}

export async function trackCargoesFlowPost(
  shipmentReference: string,
  mblNumber: string,
  webhookId: string | null,
  result: { success: boolean; response?: any; error?: string },
  additionalData?: {
    taiShipmentId?: string | null;
    containerNumber?: string | null;
    carrier?: string | null;
    bookingNumber?: string | null;
    office?: string | null;
    salesRepNames?: string[] | null;
  }
) {
  try {
    await storage.createCargoesFlowPost({
      shipmentReference,
      taiShipmentId: additionalData?.taiShipmentId || shipmentReference,
      mblNumber,
      webhookId,
      status: result.success ? "success" : "failed",
      responseData: result.response || null,
      errorMessage: result.error || null,
      containerNumber: additionalData?.containerNumber || null,
      carrier: additionalData?.carrier || null,
      bookingNumber: additionalData?.bookingNumber || null,
      office: additionalData?.office || null,
      salesRepNames: additionalData?.salesRepNames || null,
    });
  } catch (error) {
    console.error('[Cargoes Flow] Failed to track post:', error);
  }
}

interface CargoesFlowUpdateData {
  shipmentNumber: string;
  shipmentReference?: string;
  shipper?: string;
  consignee?: string;
  originDemurrageMedium?: number;
  originDemurrageHigh?: number;
  destinationDemurrageMedium?: number;
  destinationDemurrageHigh?: number;
  shipmentTags?: string;
  promisedEtd?: string;
  promisedEta?: string;
}

interface CargoesFlowUpdatePayload {
  formData: CargoesFlowUpdateData[];
}

export async function sendUpdateToCargoesFlow(
  shipmentNumber: string,
  updateData: Partial<CargoesFlowUpdateData>
): Promise<{ success: boolean; response?: any; error?: string }> {
  try {
    console.log(`[Cargoes Flow Update] Sending update for shipment ${shipmentNumber}`);

    const payload: CargoesFlowUpdatePayload = {
      formData: [
        {
          shipmentNumber,
          ...updateData
        }
      ]
    };

    console.log('[Cargoes Flow Update] Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(CARGOES_FLOW_UPDATE_API_URL, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-DPW-ApiKey": CARGOES_FLOW_API_KEY,
        "X-DPW-Org-Token": CARGOES_FLOW_ORG_TOKEN,
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[Cargoes Flow Update] Failed to send update:`, responseData);
      return { 
        success: false, 
        error: responseData.message || `HTTP ${response.status}`,
        response: responseData
      };
    }

    // Check the actual result field in the response body (can be "FAILED" even with HTTP 200)
    if (responseData.result === "FAILED") {
      const errorDetails = responseData.errorDetail || [];
      const errorMessage = errorDetails.length > 0 
        ? errorDetails.map((e: any) => e.error).join('; ')
        : responseData.message || 'Update failed';
      
      console.error(`[Cargoes Flow Update] ❌ Update failed (result: FAILED):`, responseData);
      return { 
        success: false, 
        error: errorMessage,
        response: responseData
      };
    }

    console.log(`[Cargoes Flow Update] ✅ Update sent successfully:`, responseData);
    return { success: true, response: responseData };
  } catch (error: any) {
    console.error(`[Cargoes Flow Update] Error sending update:`, error);
    return { success: false, error: error.message };
  }
}

export async function trackCargoesFlowUpdate(
  shipmentNumber: string,
  shipmentReference: string,
  webhookId: string | null,
  updateData: any,
  result: { success: boolean; response?: any; error?: string },
  taiShipmentId?: string | null
) {
  try {
    await storage.createCargoesFlowUpdateLog({
      shipmentNumber,
      shipmentReference,
      taiShipmentId: taiShipmentId || shipmentReference,
      webhookId,
      updateData,
      status: result.success ? "success" : "failed",
      responseData: result.response || null,
      errorMessage: result.error || null,
    });
  } catch (error) {
    console.error('[Cargoes Flow Update] Failed to track update:', error);
  }
}

interface DocumentUploadFile {
  fileName: string;
  fileExtension: string;
  fileData: string;
  fileSize?: number;
}

export async function uploadDocumentsToCargoesFlow(
  shipmentNumber: string,
  files: DocumentUploadFile[]
): Promise<{
  success: boolean;
  results: Array<{
    fileName: string;
    success: boolean;
    organizationId?: string;
    organizationName?: string;
    documentExtension?: string;
    createdAt?: string;
    error?: string;
  }>;
  apiResponse?: any;
  error?: string;
}> {
  try {
    console.log(`[Cargoes Flow Document Upload] Uploading ${files.length} documents for shipment ${shipmentNumber}`);

    const FormData = (await import('form-data')).default;
    const formData = new FormData();

    for (const file of files) {
      const buffer = Buffer.from(file.fileData.split(',')[1], 'base64');
      formData.append('files', buffer, { filename: file.fileName });
    }

    formData.append('shipmentNumber', shipmentNumber);

    const response = await fetch(CARGOES_FLOW_UPLOAD_DOCUMENT_API_URL, {
      method: "POST",
      headers: {
        "X-DPW-ApiKey": CARGOES_FLOW_API_KEY,
        "X-DPW-Org-Token": CARGOES_FLOW_ORG_TOKEN,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`[Cargoes Flow Document Upload] Failed:`, responseData);
      return {
        success: false,
        results: [],
        apiResponse: responseData,
        error: responseData.message || `HTTP ${response.status}`,
      };
    }

    console.log(`[Cargoes Flow Document Upload] ✅ Upload response:`, responseData);

    const results = Array.isArray(responseData) ? responseData.map((item: any) => ({
      fileName: item.nameOfDocument,
      success: !item.error,
      organizationId: item.organizationId?.toString(),
      organizationName: item.organizationName,
      documentExtension: item.documentExtension,
      createdAt: item.createdAt,
      error: item.error,
    })) : [];

    return {
      success: true,
      results,
      apiResponse: responseData,
    };
  } catch (error: any) {
    console.error(`[Cargoes Flow Document Upload] Error:`, error);
    return {
      success: false,
      results: [],
      error: error.message,
    };
  }
}
