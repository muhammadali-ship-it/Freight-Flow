import { 
  type User, 
  type InsertUser,
  type AuditLog,
  type InsertAuditLog,
  type Notification,
  type InsertNotification,
  type Organization,
  type InsertOrganization,
  type Shipment,
  type InsertShipment,
  type ShipmentUser,
  type InsertShipmentUser,
  type Milestone,
  type InsertMilestone,
  type Container,
  type InsertContainer,
  type Exception,
  type InsertException,
  type VesselPosition,
  type InsertVesselPosition,
  type RailSegment,
  type InsertRailSegment,
  type TimelineEvent,
  type InsertTimelineEvent,
  type SavedView,
  type InsertSavedView,
  type IntegrationConfig,
  type InsertIntegrationConfig,
  type IntegrationSyncLog,
  type InsertIntegrationSyncLog,
  type CarrierUpdate,
  type InsertCarrierUpdate,
  type CustomEntry,
  type InsertCustomEntry,
  type WebhookLog,
  type InsertWebhookLog,
  type CargoesFlowPost,
  type InsertCargoesFlowPost,
  type MissingMblShipment,
  type InsertMissingMblShipment,
  type CargoesFlowShipment,
  type InsertCargoesFlowShipment,
  type CargoesFlowShipmentUser,
  type InsertCargoesFlowShipmentUser,
  type CargoesFlowSyncLog,
  type InsertCargoesFlowSyncLog,
  type CargoesFlowUpdateLog,
  type InsertCargoesFlowUpdateLog,
  type CargoesFlowMapLog,
  type InsertCargoesFlowMapLog,
  type ShipmentDocument,
  type InsertShipmentDocument,
  type CargoesFlowDocumentUpload,
  type InsertCargoesFlowDocumentUpload,
  type CargoesFlowDocumentUploadLog,
  type InsertCargoesFlowDocumentUploadLog,
  users,
  auditLogs,
  notifications,
  organizations,
  shipments,
  shipmentUsers,
  milestones,
  containers,
  exceptions,
  vesselPositions,
  railSegments,
  timelineEvents,
  savedViews,
  integrationConfigs,
  integrationSyncLogs,
  carrierUpdates,
  customEntries,
  webhookLogs,
  cargoesFlowPosts,
  missingMblShipments,
  cargoesFlowShipments,
  cargoesFlowShipmentUsers,
  cargoesFlowSyncLogs,
  cargoesFlowUpdateLogs,
  cargoesFlowMapLogs,
  shipmentDocuments,
  cargoesFlowDocumentUploads,
  cargoesFlowDocumentUploadLogs,
} from "@shared/schema.js";
import { db, pool } from "./db.js";
import { eq, or, like, desc, asc, sql, SQL, and, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

// Re-export db for use in routes
export { db };

export interface PaginationParams {
  page: number;
  pageSize: number;
  sortFields?: Array<{ field: string; direction: "asc" | "desc" }>;
}

export interface ContainerFilters {
  status?: string;
  carrier?: string;
  origin?: string;
  etaFrom?: string;
  etaTo?: string;
}

export interface ShipmentFilters {
  status?: string;
  carrier?: string;
  originPort?: string;
  destinationPort?: string;
  dateRange?: { start: string; end: string };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats?: {
    total: number;
    inTransit: number;
    delayed: number;
    urgent: number;
    highRisk: number;
    hasExceptions: number;
    overdue: number;
    podNeedsAttention: number;
    podAwaitingFullOut: number;
    podFullOut: number;
    emptyReturned: number;
  };
}

export interface IStorage {
  sessionStore: session.Store;
  
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(limit?: number): Promise<AuditLog[]>;
  getAuditLogsByUser(userId: string, limit?: number): Promise<AuditLog[]>;
  getAuditLogsByEntityType(entityType: string, limit?: number): Promise<AuditLog[]>;
  
  // Notifications
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotifications(userId: string, limit?: number): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<boolean>;
  deleteAllUserNotifications(userId: string): Promise<number>;
  dismissRiskNotificationsForContainer(containerId: string, currentRiskLevel: string): Promise<number>;
  
  // Organizations
  getAllOrganizations(type?: string): Promise<Organization[]>;
  getOrganizationById(id: string): Promise<Organization | undefined>;
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: string): Promise<boolean>;
  
  getShipments(params?: PaginationParams, filters?: ShipmentFilters, userId?: string, userRole?: string): Promise<PaginatedResult<Shipment>>;
  getShipmentById(id: string): Promise<(Shipment & { containers: Container[]; milestones: Milestone[]; assignedUsers?: User[] }) | undefined>;
  getShipmentByReference(referenceNumber: string): Promise<Shipment | undefined>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: string, shipment: Partial<InsertShipment>): Promise<Shipment | undefined>;
  deleteShipment(id: string): Promise<boolean>;
  
  getShipmentUsers(shipmentId: string): Promise<ShipmentUser[]>;
  addShipmentUser(shipmentUser: InsertShipmentUser): Promise<ShipmentUser>;
  removeShipmentUser(shipmentId: string, userId: string): Promise<boolean>;
  setShipmentUsers(shipmentId: string, userIds: string[]): Promise<void>;
  
  getMilestones(shipmentId: string): Promise<Milestone[]>;
  createMilestone(milestone: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, milestone: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: string): Promise<boolean>;
  
  getAllContainers(): Promise<Container[]>;
  getPaginatedContainers(params: PaginationParams, filters?: ContainerFilters, searchQuery?: string, userName?: string, userOffice?: string, userRole?: string, filterUsers?: string[]): Promise<PaginatedResult<Container>>;
  getContainerById(id: string): Promise<Container | undefined>;
  getContainerByNumber(containerNumber: string): Promise<Container | undefined>;
  searchContainers(query: string): Promise<Container[]>;
  createContainer(container: InsertContainer): Promise<Container>;
  updateContainer(id: string, container: Partial<InsertContainer>): Promise<Container | undefined>;
  deleteContainer(id: string): Promise<boolean>;
  
  getAllExceptions(limit?: number): Promise<(Exception & { container?: Container })[]>;
  getExceptionsByContainerId(containerId: string): Promise<Exception[]>;
  createException(exception: InsertException): Promise<Exception>;
  deleteRiskAlertExceptions(containerId: string): Promise<void>;
  
  getVesselPositionByContainerId(containerId: string): Promise<VesselPosition | undefined>;
  createVesselPosition(vesselPosition: InsertVesselPosition): Promise<VesselPosition>;
  updateVesselPosition(id: string, vesselPosition: Partial<InsertVesselPosition>): Promise<VesselPosition | undefined>;
  
  getRailSegmentsByContainerId(containerId: string): Promise<RailSegment[]>;
  createRailSegment(railSegment: InsertRailSegment): Promise<RailSegment>;
  
  getTimelineEventsByContainerId(containerId: string): Promise<TimelineEvent[]>;
  createTimelineEvent(timelineEvent: InsertTimelineEvent): Promise<TimelineEvent>;
  deleteTimelineEventsByContainerId(containerId: string): Promise<boolean>;
  
  getAllSavedViews(): Promise<SavedView[]>;
  getSavedViewById(id: string): Promise<SavedView | undefined>;
  createSavedView(savedView: InsertSavedView): Promise<SavedView>;
  updateSavedView(id: string, savedView: Partial<InsertSavedView>): Promise<SavedView | undefined>;
  deleteSavedView(id: string): Promise<boolean>;

  getAllIntegrationConfigs(): Promise<IntegrationConfig[]>;
  getIntegrationConfigById(id: string): Promise<IntegrationConfig | undefined>;
  getActiveIntegrationConfigs(): Promise<IntegrationConfig[]>;
  createIntegrationConfig(config: InsertIntegrationConfig): Promise<IntegrationConfig>;
  updateIntegrationConfig(id: string, config: Partial<InsertIntegrationConfig>): Promise<IntegrationConfig | undefined>;
  deleteIntegrationConfig(id: string): Promise<boolean>;

  createIntegrationSyncLog(log: InsertIntegrationSyncLog): Promise<IntegrationSyncLog>;
  getIntegrationSyncLogsByIntegrationId(integrationId: string, limit?: number): Promise<IntegrationSyncLog[]>;

  createCarrierUpdate(update: InsertCarrierUpdate): Promise<CarrierUpdate>;
  getCarrierUpdateById(id: string): Promise<CarrierUpdate | undefined>;
  getUnprocessedCarrierUpdates(limit?: number): Promise<CarrierUpdate[]>;
  markCarrierUpdateProcessed(id: string): Promise<boolean>;

  // Cost Analytics
  getCostAnalytics(): Promise<{
    totalCost: number;
    avgDemurrage: number;
    costByType: { type: string; value: number }[];
    monthlyTrend: { month: string; cost: number }[];
    topShipmentsByCost: Array<{ 
      shipmentId: string; 
      containerNumber: string; 
      totalCost: number;
      demurrage: number;
      detention: number;
    }>;
  }>;

  // Custom Entries (user-defined carriers, ports, terminals)
  getCustomEntriesByType(type: string): Promise<CustomEntry[]>;
  createCustomEntry(entry: InsertCustomEntry): Promise<CustomEntry>;

  // TMS Webhook Logs
  createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog>;
  getWebhookLogs(params?: PaginationParams, filters?: { operation?: string; excludeOperation?: string; search?: string }): Promise<PaginatedResult<WebhookLog>>;
  getWebhookLogById(id: string): Promise<WebhookLog | undefined>;
  getAllWebhookLogs(): Promise<WebhookLog[]>;
  updateWebhookLogProcessed(id: string, processedAt: Date): Promise<WebhookLog | undefined>;
  updateWebhookLogError(id: string, errorMessage: string): Promise<WebhookLog | undefined>;
  deleteWebhookLog(id: string): Promise<boolean>;
  deleteWebhookLogsByShipmentIds(shipmentIds: string[]): Promise<number>;
  deleteAllWebhookLogs(): Promise<number>;

  // Cargoes Flow Posts
  createCargoesFlowPost(post: InsertCargoesFlowPost): Promise<CargoesFlowPost>;
  getCargoesFlowPosts(params?: PaginationParams, filters?: { search?: string }): Promise<PaginatedResult<CargoesFlowPost>>;
  getCargoesFlowPostById(id: string): Promise<CargoesFlowPost | undefined>;
  getCargoesFlowPostByReference(shipmentReference: string): Promise<CargoesFlowPost | undefined>;
  getCargoesFlowPostByMbl(mblNumber: string): Promise<CargoesFlowPost | undefined>;
  updateCargoesFlowPostStatus(id: string, status: string, responseData?: any, errorMessage?: string): Promise<CargoesFlowPost | undefined>;

  // Missing MBL Shipments
  createMissingMblShipment(shipment: InsertMissingMblShipment): Promise<MissingMblShipment>;
  getMissingMblShipments(params?: PaginationParams, filters?: { search?: string }): Promise<PaginatedResult<MissingMblShipment>>;
  getMissingMblShipmentByReference(shipmentReference: string): Promise<MissingMblShipment | undefined>;
  deleteMissingMblShipment(id: string): Promise<boolean>;

  // Cargoes Flow Shipments (fetched from API)
  upsertCargoesFlowShipment(shipment: InsertCargoesFlowShipment): Promise<CargoesFlowShipment>;
  getCargoesFlowShipments(params?: PaginationParams, filters?: ShipmentFilters & { search?: string; userName?: string; userOffice?: string; userRole?: string }): Promise<PaginatedResult<CargoesFlowShipment>>;
  getGroupedCargoesFlowShipments(params?: PaginationParams, filters?: ShipmentFilters & { search?: string; userName?: string; userOffice?: string; userRole?: string }): Promise<PaginatedResult<any>>;
  getCargoesFlowShipmentById(id: string): Promise<CargoesFlowShipment | undefined>;
  getCargoesFlowShipmentByReference(shipmentReference: string): Promise<CargoesFlowShipment | undefined>;
  getCargoesFlowShipmentByContainer(containerNumber: string): Promise<CargoesFlowShipment | undefined>;
  getCargoesFlowShipmentByContainerInRawData(containerNumber: string): Promise<CargoesFlowShipment | undefined>;
  getCargoesFlowShipmentByMbl(mblNumber: string): Promise<CargoesFlowShipment | undefined>;
  getAllCargoesFlowShipmentsByMbl(mblNumber: string): Promise<CargoesFlowShipment[]>;
  updateCargoesFlowShipment(id: string, shipment: Partial<InsertCargoesFlowShipment>): Promise<CargoesFlowShipment | undefined>;
  getTaiShipmentIdByMbl(mblNumber: string): Promise<string | null>;
  deleteCargoesFlowShipment(id: string): Promise<boolean>;
  
  getCargoesFlowShipmentUsers(shipmentId: string): Promise<CargoesFlowShipmentUser[]>;
  setCargoesFlowShipmentUsers(shipmentId: string, userIds: string[]): Promise<void>;
  
  getContainers(shipmentId: string): Promise<Container[]>;

  // Cargoes Flow Sync Logs
  createCargoesFlowSyncLog(log: InsertCargoesFlowSyncLog): Promise<CargoesFlowSyncLog>;
  getCargoesFlowSyncLogs(params?: PaginationParams): Promise<PaginatedResult<CargoesFlowSyncLog>>;
  getLatestCargoesFlowSyncLog(): Promise<CargoesFlowSyncLog | undefined>;

  // Cargoes Flow Update Logs
  createCargoesFlowUpdateLog(log: InsertCargoesFlowUpdateLog): Promise<CargoesFlowUpdateLog>;
  getCargoesFlowUpdateLogs(params?: PaginationParams, filters?: { search?: string }): Promise<PaginatedResult<CargoesFlowUpdateLog>>;
  getCargoesFlowUpdateLogById(id: string): Promise<CargoesFlowUpdateLog | undefined>;

  // Cargoes Flow Map Logs
  createCargoesFlowMapLog(log: InsertCargoesFlowMapLog): Promise<CargoesFlowMapLog>;
  getCargoesFlowMapLogsByShipmentNumber(shipmentNumber: string, limit?: number): Promise<CargoesFlowMapLog[]>;

  // Shipment Documents
  createShipmentDocument(document: InsertShipmentDocument): Promise<ShipmentDocument>;
  getShipmentDocuments(shipmentId: string): Promise<ShipmentDocument[]>;
  getShipmentDocumentById(id: string): Promise<ShipmentDocument | undefined>;
  deleteShipmentDocument(id: string): Promise<boolean>;

  // Cargoes Flow Document Uploads
  createCargoesFlowDocumentUpload(upload: InsertCargoesFlowDocumentUpload): Promise<CargoesFlowDocumentUpload>;
  getCargoesFlowDocumentUploads(params?: PaginationParams, filters?: { shipmentNumber?: string; uploadStatus?: string }): Promise<PaginatedResult<CargoesFlowDocumentUpload>>;
  getCargoesFlowDocumentUploadById(id: string): Promise<CargoesFlowDocumentUpload | undefined>;
  updateCargoesFlowDocumentUploadStatus(id: string, status: string, errorMessage?: string, cargoesFlowCreatedAt?: Date): Promise<CargoesFlowDocumentUpload | undefined>;

  // Cargoes Flow Document Upload Logs
  createCargoesFlowDocumentUploadLog(log: InsertCargoesFlowDocumentUploadLog): Promise<CargoesFlowDocumentUploadLog>;
  getCargoesFlowDocumentUploadLogs(params?: PaginationParams): Promise<PaginatedResult<CargoesFlowDocumentUploadLog>>;
  getCargoesFlowDocumentUploadLogById(id: string): Promise<CargoesFlowDocumentUploadLog | undefined>;
  updateCargoesFlowDocumentUploadLogStatus(id: string, successCount: number, failCount: number, completedAt: Date, apiResponse?: string, errorDetails?: string): Promise<CargoesFlowDocumentUploadLog | undefined>;

  // Cargoes Flow Filters - Distinct values for dropdowns
  getDistinctCarriers(): Promise<string[]>;
  getDistinctPorts(): Promise<string[]>;
}

const PostgresSessionStore = connectPg(session);

export class DbStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username) return undefined;
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async updateUser(id: string, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  async getAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async getAuditLogsByUser(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAuditLogsByEntityType(entityType: string, limit: number = 100): Promise<AuditLog[]> {
    return await db.select().from(auditLogs)
      .where(eq(auditLogs.entityType, entityType))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [result] = await db.insert(notifications).values(notification).returning();
    return result;
  }

  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    return result[0]?.count || 0;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<Notification | undefined> {
    const [result] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ))
      .returning();
    return result;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const result = await db.delete(notifications)
      .where(and(
        eq(notifications.id, id),
        eq(notifications.userId, userId)
      ));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteAllUserNotifications(userId: string): Promise<number> {
    const result = await db.delete(notifications)
      .where(eq(notifications.userId, userId));
    return result.rowCount ?? 0;
  }

  async dismissRiskNotificationsForContainer(containerId: string, currentRiskLevel: string): Promise<number> {
    const riskLevelValues: Record<string, number> = {
      'critical': 4,
      'high': 3,
      'medium': 2,
      'low': 1,
    };
    
    const currentRiskValue = riskLevelValues[currentRiskLevel] || 0;
    
    // Get all notifications for this container
    const containerNotifications = await db.select()
      .from(notifications)
      .where(and(
        eq(notifications.entityType, 'CONTAINER'),
        eq(notifications.entityId, containerId),
        eq(notifications.isRead, false)
      ));
    
    let dismissedCount = 0;
    
    // Filter and delete notifications with higher risk levels
    for (const notification of containerNotifications) {
      const metadata = notification.metadata as any;
      if (metadata?.riskLevel) {
        const notificationRiskValue = riskLevelValues[metadata.riskLevel] || 0;
        
        // If the notification has a higher risk level than current, dismiss it
        if (notificationRiskValue > currentRiskValue) {
          await db.delete(notifications)
            .where(eq(notifications.id, notification.id));
          dismissedCount++;
        }
      }
    }
    
    return dismissedCount;
  }

  async getAllOrganizations(type?: string): Promise<Organization[]> {
    if (type && type !== 'all') {
      return await db.select().from(organizations).where(
        or(
          eq(organizations.type, type),
          eq(organizations.type, 'both')
        )
      );
    }
    return await db.select().from(organizations).orderBy(organizations.name);
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    const result = await db.select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }

  async createOrganization(organization: InsertOrganization): Promise<Organization> {
    const result = await db.insert(organizations).values(organization).returning();
    return result[0];
  }

  async updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const result = await db.update(organizations)
      .set({ ...organization, updatedAt: new Date() })
      .where(eq(organizations.id, id))
      .returning();
    return result[0];
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await db.delete(organizations).where(eq(organizations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getShipments(params?: PaginationParams, filters?: ShipmentFilters, userId?: string, userRole?: string): Promise<PaginatedResult<Shipment>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 50;
    const offset = (page - 1) * pageSize;

    const whereClauses: SQL[] = [];

    if (filters) {
      if (filters.status && filters.status !== "all") {
        whereClauses.push(eq(shipments.status, filters.status));
      }
      if (filters.carrier && filters.carrier !== "all") {
        whereClauses.push(eq(shipments.carrier, filters.carrier));
      }
      if (filters.originPort && filters.originPort !== "all") {
        whereClauses.push(eq(shipments.originPort, filters.originPort));
      }
      if (filters.destinationPort && filters.destinationPort !== "all") {
        whereClauses.push(eq(shipments.destinationPort, filters.destinationPort));
      }
      if (filters.dateRange) {
        whereClauses.push(
          sql`${shipments.createdAt} >= ${filters.dateRange.start}::timestamp AND ${shipments.createdAt} <= ${filters.dateRange.end}::timestamp`
        );
      }
    }

    if (userId && userRole !== "Admin") {
      whereClauses.push(
        sql`${shipments.id} IN (SELECT ${shipmentUsers.shipmentId} FROM ${shipmentUsers} WHERE ${shipmentUsers.userId} = ${userId})`
      );
    }

    const whereClause = whereClauses.length > 0 
      ? sql`${whereClauses.reduce((acc, clause, idx) => {
          return idx === 0 ? clause : sql`${acc} AND ${clause}`;
        })}`
      : undefined;

    const orderByClause: SQL[] = [];
    if (params?.sortFields && params.sortFields.length > 0) {
      for (const sort of params.sortFields) {
        const column = shipments[sort.field as keyof typeof shipments];
        if (column && typeof column !== 'function') {
          orderByClause.push(sort.direction === "asc" ? asc(column as any) : desc(column as any));
        }
      }
    } else {
      orderByClause.push(desc(shipments.createdAt));
    }

    let query = db.select().from(shipments);
    if (whereClause) {
      query = query.where(whereClause) as typeof query;
    }

    const data = await query
      .orderBy(...orderByClause)
      .limit(pageSize)
      .offset(offset);

    // Add container count for each shipment
    const shipmentsWithCount = await Promise.all(
      data.map(async (shipment) => {
        const containerCountResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(containers)
          .where(eq(containers.shipmentId, shipment.id));
        
        return {
          ...shipment,
          containerCount: Number(containerCountResult[0]?.count || 0),
        };
      })
    );

    const baseCondition = whereClause || sql`TRUE`;
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(shipments)
      .where(baseCondition);
    const total = Number(totalResult[0]?.count || 0);

    return {
      data: shipmentsWithCount,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getShipmentById(id: string): Promise<(Shipment & { containers: Container[]; milestones: Milestone[]; assignedUsers?: User[] }) | undefined> {
    const shipmentResult = await db.select().from(shipments).where(eq(shipments.id, id));
    if (!shipmentResult[0]) return undefined;

    const shipmentContainers = await db.select().from(containers)
      .where(eq(containers.shipmentId, id))
      .orderBy(desc(containers.createdAt));

    const shipmentMilestones = await db.select().from(milestones)
      .where(eq(milestones.shipmentId, id))
      .orderBy(asc(milestones.createdAt));

    const assignedUserIds = await db.select().from(shipmentUsers)
      .where(eq(shipmentUsers.shipmentId, id));
    
    const assignedUsers: User[] = [];
    if (assignedUserIds.length > 0) {
      const userPromises = assignedUserIds.map(su => 
        db.select().from(users).where(eq(users.id, su.userId)).then(result => result[0])
      );
      const fetchedUsers = await Promise.all(userPromises);
      assignedUsers.push(...fetchedUsers.filter(Boolean));
    }

    return {
      ...shipmentResult[0],
      containers: shipmentContainers,
      milestones: shipmentMilestones,
      assignedUsers,
    };
  }

  async getShipmentByReference(referenceNumber: string): Promise<Shipment | undefined> {
    const result = await db.select().from(shipments).where(eq(shipments.referenceNumber, referenceNumber));
    return result[0];
  }

  async createShipment(insertShipment: InsertShipment): Promise<Shipment> {
    const result = await db.insert(shipments).values(insertShipment).returning();
    return result[0];
  }

  async updateShipment(id: string, shipmentUpdate: Partial<InsertShipment>): Promise<Shipment | undefined> {
    const result = await db.update(shipments)
      .set({ ...shipmentUpdate, updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return result[0];
  }

  async deleteShipment(id: string): Promise<boolean> {
    const result = await db.delete(shipments).where(eq(shipments.id, id)).returning();
    return result.length > 0;
  }

  async getShipmentUsers(shipmentId: string): Promise<ShipmentUser[]> {
    return await db.select().from(shipmentUsers).where(eq(shipmentUsers.shipmentId, shipmentId));
  }

  async addShipmentUser(shipmentUser: InsertShipmentUser): Promise<ShipmentUser> {
    const result = await db.insert(shipmentUsers).values(shipmentUser).returning();
    return result[0];
  }

  async removeShipmentUser(shipmentId: string, userId: string): Promise<boolean> {
    const result = await db.delete(shipmentUsers)
      .where(sql`${shipmentUsers.shipmentId} = ${shipmentId} AND ${shipmentUsers.userId} = ${userId}`)
      .returning();
    return result.length > 0;
  }

  async setShipmentUsers(shipmentId: string, userIds: string[]): Promise<void> {
    await db.delete(shipmentUsers).where(eq(shipmentUsers.shipmentId, shipmentId));
    
    if (userIds.length > 0) {
      const values = userIds.map(userId => ({ shipmentId, userId }));
      await db.insert(shipmentUsers).values(values);
    }
  }

  async getMilestones(shipmentId: string): Promise<Milestone[]> {
    return await db.select().from(milestones)
      .where(eq(milestones.shipmentId, shipmentId))
      .orderBy(asc(milestones.createdAt));
  }

  async createMilestone(insertMilestone: InsertMilestone): Promise<Milestone> {
    const result = await db.insert(milestones).values(insertMilestone).returning();
    return result[0];
  }

  async updateMilestone(id: string, milestoneUpdate: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const result = await db.update(milestones)
      .set({ ...milestoneUpdate, updatedAt: new Date() })
      .where(eq(milestones.id, id))
      .returning();
    return result[0];
  }

  async deleteMilestone(id: string): Promise<boolean> {
    const result = await db.delete(milestones).where(eq(milestones.id, id)).returning();
    return result.length > 0;
  }

  async getAllContainers(): Promise<Container[]> {
    return await db.select().from(containers).orderBy(desc(containers.createdAt));
  }

  async getPaginatedContainers(params: PaginationParams, filters?: ContainerFilters, searchQuery?: string, userName?: string, userOffice?: string, userRole?: string, filterUsers?: string[]): Promise<PaginatedResult<Container>> {
    const { page, pageSize, sortFields } = params;
    const offset = (page - 1) * pageSize;

    // Build where clauses
    const whereClauses: SQL[] = [];
    
    // Add specific user filter (if provided, filter by selected users using AND logic)
    if (filterUsers && filterUsers.length > 0) {
      const shipmentIdSets = await Promise.all(
        filterUsers.map(async (userId) => {
          const userShipments = await db
            .select({ shipmentId: shipmentUsers.shipmentId })
            .from(shipmentUsers)
            .where(eq(shipmentUsers.userId, userId));
          return new Set(userShipments.map(s => s.shipmentId));
        })
      );
      
      const intersectionShipmentIds = shipmentIdSets.reduce((acc, set) => {
        if (acc === null) return set;
        return new Set(Array.from(acc).filter(id => set.has(id)));
      }, null as Set<string> | null);
      
      const finalShipmentIds = intersectionShipmentIds ? Array.from(intersectionShipmentIds) : [];
      
      if (finalShipmentIds.length > 0) {
        whereClauses.push(inArray(containers.shipmentId, finalShipmentIds));
      } else {
        whereClauses.push(sql`1 = 0`);
      }
    }
    // Role-based filtering (matching Cargoes Flow pattern)
    // Note: containers table doesn't have salesRepNames/office fields
    // This will need to join with shipments table or filter differently
    // For now, Admin sees all, others see empty results until we implement proper sync
    else if (userRole && userRole !== "Admin") {
      // Non-admins should only see containers from Cargoes Flow shipments they have access to
      // Since containers table is separate from cargoesFlowShipments, return empty for now
      // The Dashboard should query Cargoes Flow shipments instead
      whereClauses.push(sql`1 = 0`); // Return empty results for non-admins
    }
    
    // Add search filter
    if (searchQuery && searchQuery.trim()) {
      const searchPattern = `%${searchQuery}%`;
      whereClauses.push(
        or(
          like(containers.containerNumber, searchPattern),
          like(containers.masterBillOfLading, searchPattern),
          like(containers.bookingNumber, searchPattern),
          like(containers.reference, searchPattern),
          like(containers.vesselName, searchPattern)
        )!
      );
    }

    // Add field filters
    if (filters) {
      if (filters.status && filters.status !== "all") {
        whereClauses.push(eq(containers.status, filters.status));
      }
      if (filters.carrier && filters.carrier !== "all") {
        whereClauses.push(eq(containers.carrier, filters.carrier));
      }
      if (filters.origin && filters.origin !== "all") {
        whereClauses.push(eq(containers.origin, filters.origin));
      }
      if (filters.etaFrom) {
        whereClauses.push(sql`${containers.eta} >= ${filters.etaFrom}`);
      }
      if (filters.etaTo) {
        whereClauses.push(sql`${containers.eta} <= ${filters.etaTo}`);
      }
    }

    // Combine where clauses with AND
    const whereClause = whereClauses.length > 0 
      ? sql`${whereClauses.reduce((acc, clause, idx) => {
          return idx === 0 ? clause : sql`${acc} AND ${clause}`;
        })}`
      : undefined;

    // Build order by clause
    const orderByClause: SQL[] = [];
    if (sortFields && sortFields.length > 0) {
      for (const sort of sortFields) {
        const column = containers[sort.field as keyof typeof containers];
        if (column && typeof column !== 'function') {
          orderByClause.push(sort.direction === "asc" ? asc(column as any) : desc(column as any));
        }
      }
    } else {
      // Default sort by createdAt desc
      orderByClause.push(desc(containers.createdAt));
    }

    // Execute query with pagination
    let query = db.select().from(containers);
    if (whereClause) {
      query = query.where(whereClause) as typeof query;
    }
    
    const rawData = await query
      .orderBy(...orderByClause)
      .limit(pageSize)
      .offset(offset);

    // Add hasExceptions flag to each container
    const containerIdsForPage = rawData.map(c => c.id);
    const exceptionsForPage = containerIdsForPage.length > 0
      ? await db.select({ containerId: exceptions.containerId })
          .from(exceptions)
          .where(sql`${exceptions.containerId} IN (${sql.join(containerIdsForPage.map(id => sql`${id}`), sql`, `)})`)
      : [];
    const containerIdsWithExceptions = new Set(exceptionsForPage.map(e => e.containerId));

    const data = rawData.map(container => ({
      ...container,
      hasExceptions: containerIdsWithExceptions.has(container.id),
    }));

    // Get total count and stats using efficient aggregate queries
    const baseCondition = whereClause || sql`TRUE`;

    // Total count
    const totalResult = await db.select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(baseCondition);
    const total = Number(totalResult[0]?.count || 0);

    // In Transit count
    const inTransitResult = await db.select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(sql`${baseCondition} AND ${containers.status} = 'in-transit'`);
    const inTransitCount = Number(inTransitResult[0]?.count || 0);

    // Delayed count
    const delayedResult = await db.select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(sql`${baseCondition} AND ${containers.status} = 'delayed'`);
    const delayedCount = Number(delayedResult[0]?.count || 0);

    // High Risk count
    const highRiskResult = await db.select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(sql`${baseCondition} AND ${containers.riskLevel} = 'high'`);
    const highRiskCount = Number(highRiskResult[0]?.count || 0);

    // Has Exceptions count (distinct containers with exceptions)
    const hasExceptionsResult = await db.select({ count: sql<number>`count(DISTINCT ${exceptions.containerId})` })
      .from(exceptions)
      .innerJoin(containers, eq(containers.id, exceptions.containerId))
      .where(baseCondition);
    const hasExceptionsCount = Number(hasExceptionsResult[0]?.count || 0);

    // Urgent count (lastFreeDay within 0-3 days from today)
    const urgentResult = await db.select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(sql`
        ${baseCondition} AND 
        ${containers.lastFreeDay} IS NOT NULL AND
        ${containers.lastFreeDay} != '' AND
        (${containers.lastFreeDay}::date - CURRENT_DATE) >= 0 AND
        (${containers.lastFreeDay}::date - CURRENT_DATE) <= 3
      `);
    const urgentCount = Number(urgentResult[0]?.count || 0);

    // Overdue count (lastFreeDay before today)
    const overdueResult = await db.select({ count: sql<number>`count(*)` })
      .from(containers)
      .where(sql`
        ${baseCondition} AND 
        ${containers.lastFreeDay} IS NOT NULL AND
        ${containers.lastFreeDay} != '' AND
        ${containers.lastFreeDay}::date < CURRENT_DATE
      `);
    const overdueCount = Number(overdueResult[0]?.count || 0);

    // POD needs Attention count (containers with POD_NEEDS_ATTENTION milestone)
    const podNeedsAttentionResult = await db.select({ count: sql<number>`count(DISTINCT ${containers.id})` })
      .from(containers)
      .innerJoin(shipments, eq(containers.shipmentId, shipments.id))
      .innerJoin(milestones, eq(milestones.shipmentId, shipments.id))
      .where(sql`${baseCondition} AND ${milestones.eventType} = 'POD_NEEDS_ATTENTION'`);
    const podNeedsAttentionCount = Number(podNeedsAttentionResult[0]?.count || 0);

    // POD awaiting Full Out count
    const podAwaitingFullOutResult = await db.select({ count: sql<number>`count(DISTINCT ${containers.id})` })
      .from(containers)
      .innerJoin(shipments, eq(containers.shipmentId, shipments.id))
      .innerJoin(milestones, eq(milestones.shipmentId, shipments.id))
      .where(sql`${baseCondition} AND ${milestones.eventType} = 'POD_AWAITING_FULL_OUT'`);
    const podAwaitingFullOutCount = Number(podAwaitingFullOutResult[0]?.count || 0);

    // POD Full Out count
    const podFullOutResult = await db.select({ count: sql<number>`count(DISTINCT ${containers.id})` })
      .from(containers)
      .innerJoin(shipments, eq(containers.shipmentId, shipments.id))
      .innerJoin(milestones, eq(milestones.shipmentId, shipments.id))
      .where(sql`${baseCondition} AND ${milestones.eventType} = 'POD_FULL_OUT'`);
    const podFullOutCount = Number(podFullOutResult[0]?.count || 0);

    // Empty Returned count
    const emptyReturnedResult = await db.select({ count: sql<number>`count(DISTINCT ${containers.id})` })
      .from(containers)
      .innerJoin(shipments, eq(containers.shipmentId, shipments.id))
      .innerJoin(milestones, eq(milestones.shipmentId, shipments.id))
      .where(sql`${baseCondition} AND ${milestones.eventType} = 'EMPTY_RETURNED'`);
    const emptyReturnedCount = Number(emptyReturnedResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        total,
        inTransit: inTransitCount,
        delayed: delayedCount,
        urgent: urgentCount,
        highRisk: highRiskCount,
        hasExceptions: hasExceptionsCount,
        overdue: overdueCount,
        podNeedsAttention: podNeedsAttentionCount,
        podAwaitingFullOut: podAwaitingFullOutCount,
        podFullOut: podFullOutCount,
        emptyReturned: emptyReturnedCount,
      },
    };
  }

  async getContainerById(id: string): Promise<Container | undefined> {
    const result = await db.select().from(containers).where(eq(containers.id, id));
    return result[0];
  }

  async getContainerByNumber(containerNumber: string): Promise<Container | undefined> {
    const result = await db.select().from(containers).where(eq(containers.containerNumber, containerNumber));
    return result[0];
  }

  async searchContainers(query: string): Promise<Container[]> {
    const searchPattern = `%${query}%`;
    return await db.select().from(containers).where(
      or(
        like(containers.containerNumber, searchPattern),
        like(containers.masterBillOfLading, searchPattern),
        like(containers.bookingNumber, searchPattern),
        like(containers.reference, searchPattern)
      )
    );
  }

  async createContainer(insertContainer: InsertContainer): Promise<Container> {
    const result = await db.insert(containers).values(insertContainer).returning();
    return result[0];
  }

  async updateContainer(id: string, containerUpdate: Partial<InsertContainer>): Promise<Container | undefined> {
    const result = await db.update(containers)
      .set({ ...containerUpdate, updatedAt: new Date() })
      .where(eq(containers.id, id))
      .returning();
    return result[0];
  }

  async deleteContainer(id: string): Promise<boolean> {
    const result = await db.delete(containers).where(eq(containers.id, id)).returning();
    return result.length > 0;
  }

  async getAllExceptions(limit: number = 50): Promise<(Exception & { container?: Container })[]> {
    const result = await db.select({
      id: exceptions.id,
      containerId: exceptions.containerId,
      type: exceptions.type,
      title: exceptions.title,
      description: exceptions.description,
      timestamp: exceptions.timestamp,
      createdAt: exceptions.createdAt,
      container: containers,
    })
      .from(exceptions)
      .leftJoin(containers, eq(exceptions.containerId, containers.id))
      .orderBy(desc(exceptions.createdAt))
      .limit(limit);
    
    return result.map(row => ({
      id: row.id,
      containerId: row.containerId,
      type: row.type,
      title: row.title,
      description: row.description,
      timestamp: row.timestamp,
      createdAt: row.createdAt,
      container: row.container || undefined,
    }));
  }

  async getExceptionsByContainerId(containerId: string): Promise<Exception[]> {
    return await db.select().from(exceptions).where(eq(exceptions.containerId, containerId));
  }

  async createException(insertException: InsertException): Promise<Exception> {
    const result = await db.insert(exceptions).values(insertException).returning();
    return result[0];
  }

  async deleteRiskAlertExceptions(containerId: string): Promise<void> {
    await db.delete(exceptions)
      .where(
        and(
          eq(exceptions.containerId, containerId),
          like(exceptions.title, '%Risk Alert')
        )
      );
  }

  async getVesselPositionByContainerId(containerId: string): Promise<VesselPosition | undefined> {
    const result = await db.select().from(vesselPositions)
      .where(eq(vesselPositions.containerId, containerId))
      .orderBy(desc(vesselPositions.createdAt))
      .limit(1);
    return result[0];
  }

  async createVesselPosition(insertVesselPosition: InsertVesselPosition): Promise<VesselPosition> {
    const result = await db.insert(vesselPositions).values(insertVesselPosition).returning();
    return result[0];
  }

  async updateVesselPosition(id: string, vesselPositionUpdate: Partial<InsertVesselPosition>): Promise<VesselPosition | undefined> {
    const result = await db.update(vesselPositions)
      .set(vesselPositionUpdate)
      .where(eq(vesselPositions.id, id))
      .returning();
    return result[0];
  }

  async getRailSegmentsByContainerId(containerId: string): Promise<RailSegment[]> {
    return await db.select().from(railSegments).where(eq(railSegments.containerId, containerId));
  }

  async createRailSegment(insertRailSegment: InsertRailSegment): Promise<RailSegment> {
    const result = await db.insert(railSegments).values(insertRailSegment).returning();
    return result[0];
  }

  async getTimelineEventsByContainerId(containerId: string): Promise<TimelineEvent[]> {
    return await db.select().from(timelineEvents).where(eq(timelineEvents.containerId, containerId));
  }

  async createTimelineEvent(insertTimelineEvent: InsertTimelineEvent): Promise<TimelineEvent> {
    const result = await db.insert(timelineEvents).values(insertTimelineEvent).returning();
    return result[0];
  }

  async deleteTimelineEventsByContainerId(containerId: string): Promise<boolean> {
    const result = await db.delete(timelineEvents).where(eq(timelineEvents.containerId, containerId)).returning();
    return result.length > 0;
  }

  async getAllSavedViews(): Promise<SavedView[]> {
    return await db.select().from(savedViews).orderBy(desc(savedViews.createdAt));
  }

  async getSavedViewById(id: string): Promise<SavedView | undefined> {
    const result = await db.select().from(savedViews).where(eq(savedViews.id, id));
    return result[0];
  }

  async createSavedView(insertSavedView: InsertSavedView): Promise<SavedView> {
    const result = await db.insert(savedViews).values(insertSavedView).returning();
    return result[0];
  }

  async updateSavedView(id: string, savedViewUpdate: Partial<InsertSavedView>): Promise<SavedView | undefined> {
    const result = await db.update(savedViews)
      .set({ ...savedViewUpdate, updatedAt: new Date() })
      .where(eq(savedViews.id, id))
      .returning();
    return result[0];
  }

  async deleteSavedView(id: string): Promise<boolean> {
    const result = await db.delete(savedViews).where(eq(savedViews.id, id)).returning();
    return result.length > 0;
  }

  async getAllIntegrationConfigs(): Promise<IntegrationConfig[]> {
    return await db.select().from(integrationConfigs).orderBy(desc(integrationConfigs.createdAt));
  }

  async getIntegrationConfigById(id: string): Promise<IntegrationConfig | undefined> {
    const result = await db.select().from(integrationConfigs).where(eq(integrationConfigs.id, id));
    return result[0];
  }

  async getActiveIntegrationConfigs(): Promise<IntegrationConfig[]> {
    return await db.select().from(integrationConfigs).where(eq(integrationConfigs.isActive, true));
  }

  async createIntegrationConfig(insertConfig: InsertIntegrationConfig): Promise<IntegrationConfig> {
    const result = await db.insert(integrationConfigs).values(insertConfig).returning();
    return result[0];
  }

  async updateIntegrationConfig(id: string, configUpdate: Partial<InsertIntegrationConfig>): Promise<IntegrationConfig | undefined> {
    const result = await db.update(integrationConfigs)
      .set({ ...configUpdate, updatedAt: new Date() })
      .where(eq(integrationConfigs.id, id))
      .returning();
    return result[0];
  }

  async deleteIntegrationConfig(id: string): Promise<boolean> {
    const result = await db.delete(integrationConfigs).where(eq(integrationConfigs.id, id)).returning();
    return result.length > 0;
  }

  async createIntegrationSyncLog(insertLog: InsertIntegrationSyncLog): Promise<IntegrationSyncLog> {
    const result = await db.insert(integrationSyncLogs).values(insertLog).returning();
    return result[0];
  }

  async getIntegrationSyncLogsByIntegrationId(integrationId: string, limit: number = 50): Promise<IntegrationSyncLog[]> {
    return await db.select().from(integrationSyncLogs)
      .where(eq(integrationSyncLogs.integrationId, integrationId))
      .orderBy(desc(integrationSyncLogs.createdAt))
      .limit(limit);
  }

  async createCarrierUpdate(insertUpdate: InsertCarrierUpdate): Promise<CarrierUpdate> {
    const result = await db.insert(carrierUpdates).values(insertUpdate).returning();
    return result[0];
  }

  async getCarrierUpdateById(id: string): Promise<CarrierUpdate | undefined> {
    const result = await db.select().from(carrierUpdates).where(eq(carrierUpdates.id, id));
    return result[0];
  }

  async getUnprocessedCarrierUpdates(limit: number = 100): Promise<CarrierUpdate[]> {
    return await db.select().from(carrierUpdates)
      .where(eq(carrierUpdates.processed, false))
      .orderBy(asc(carrierUpdates.createdAt))
      .limit(limit);
  }

  async markCarrierUpdateProcessed(id: string): Promise<boolean> {
    const result = await db.update(carrierUpdates)
      .set({ processed: true })
      .where(eq(carrierUpdates.id, id))
      .returning();
    return result.length > 0;
  }

  async getCostAnalytics(): Promise<{
    totalCost: number;
    avgDemurrage: number;
    costByType: { type: string; value: number }[];
    monthlyTrend: { month: string; cost: number }[];
    topShipmentsByCost: Array<{ 
      shipmentId: string; 
      containerNumber: string; 
      totalCost: number;
      demurrage: number;
      detention: number;
    }>;
  }> {
    // Get all containers with cost data
    const allContainers = await db.select().from(containers);

    // Calculate totals
    let totalDemurrage = 0;
    let totalDetention = 0;
    let totalException = 0;
    let demurrageCount = 0;

    const containerCosts = allContainers.map(c => {
      const demurrage = parseFloat(c.demurrageFee || "0");
      const detention = parseFloat(c.detentionFee || "0");
      const exception = parseFloat(c.exceptionCost || "0");
      const total = demurrage + detention + exception;

      totalDemurrage += demurrage;
      totalDetention += detention;
      totalException += exception;
      if (demurrage > 0) demurrageCount++;

      return {
        shipmentId: c.shipmentId,
        containerNumber: c.containerNumber,
        totalCost: total,
        demurrage,
        detention,
        createdAt: c.createdAt,
      };
    });

    const totalCost = totalDemurrage + totalDetention + totalException;
    const avgDemurrage = demurrageCount > 0 ? totalDemurrage / demurrageCount : 0;

    // Cost by type
    const costByType = [
      { type: "Demurrage", value: totalDemurrage },
      { type: "Detention", value: totalDetention },
      { type: "Exception", value: totalException },
    ];

    // Monthly trend - last 6 months
    const monthlyTrendMap = new Map<string, number>();
    allContainers.forEach(c => {
      if (c.createdAt) {
        const date = new Date(c.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const cost = parseFloat(c.demurrageFee || "0") + 
                     parseFloat(c.detentionFee || "0") + 
                     parseFloat(c.exceptionCost || "0");
        monthlyTrendMap.set(monthKey, (monthlyTrendMap.get(monthKey) || 0) + cost);
      }
    });

    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .map(([month, cost]) => ({ month, cost }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);

    // Top 10 shipments by cost
    const topShipmentsByCost = containerCosts
      .filter(c => c.totalCost > 0)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    return {
      totalCost,
      avgDemurrage,
      costByType,
      monthlyTrend,
      topShipmentsByCost,
    };
  }

  async getCustomEntriesByType(type: string): Promise<CustomEntry[]> {
    return await db.select().from(customEntries).where(eq(customEntries.type, type));
  }

  async createCustomEntry(entry: InsertCustomEntry): Promise<CustomEntry> {
    // Check if this value already exists for this type (case-insensitive)
    const existing = await db.select().from(customEntries)
      .where(and(
        eq(customEntries.type, entry.type),
        sql`LOWER(${customEntries.value}) = LOWER(${entry.value})`
      ))
      .limit(1);
    
    if (existing.length > 0) {
      return existing[0];
    }

    const result = await db.insert(customEntries).values(entry).returning();
    return result[0];
  }

  async createWebhookLog(log: InsertWebhookLog): Promise<WebhookLog> {
    const result = await db.insert(webhookLogs).values(log).returning();
    return result[0];
  }

  async getWebhookLogs(
    params: PaginationParams = { page: 1, pageSize: 50 },
    filters?: { operation?: string; excludeOperation?: string; search?: string }
  ): Promise<PaginatedResult<WebhookLog>> {
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];
    
    if (filters?.operation && filters.operation !== "all") {
      conditions.push(eq(webhookLogs.operation, filters.operation));
    }

    if (filters?.excludeOperation) {
      // Include NULL values and values that don't match the excluded operation
      conditions.push(
        or(
          sql`${webhookLogs.operation} IS NULL`,
          sql`${webhookLogs.operation} != ${filters.excludeOperation}`
        )!
      );
    }

    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${webhookLogs.shipmentId} ILIKE ${searchTerm}`,
          sql`${webhookLogs.containerNumber} ILIKE ${searchTerm}`,
          sql`${webhookLogs.eventType} ILIKE ${searchTerm}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(webhookLogs)
        .where(whereClause),
      db.select()
        .from(webhookLogs)
        .where(whereClause)
        .orderBy(desc(webhookLogs.receivedAt))
        .limit(pageSize)
        .offset(offset)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getWebhookLogById(id: string): Promise<WebhookLog | undefined> {
    const result = await db.select().from(webhookLogs).where(eq(webhookLogs.id, id));
    return result[0];
  }

  async updateWebhookLogProcessed(id: string, processedAt: Date): Promise<WebhookLog | undefined> {
    const result = await db.update(webhookLogs)
      .set({ processedAt })
      .where(eq(webhookLogs.id, id))
      .returning();
    return result[0];
  }

  async updateWebhookLogError(id: string, errorMessage: string): Promise<WebhookLog | undefined> {
    const result = await db.update(webhookLogs)
      .set({ errorMessage })
      .where(eq(webhookLogs.id, id))
      .returning();
    return result[0];
  }

  async getAllWebhookLogs(): Promise<WebhookLog[]> {
    return await db.select().from(webhookLogs).orderBy(desc(webhookLogs.receivedAt));
  }

  async deleteWebhookLog(id: string): Promise<boolean> {
    const result = await db.delete(webhookLogs).where(eq(webhookLogs.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteWebhookLogsByShipmentIds(shipmentIds: string[]): Promise<number> {
    if (shipmentIds.length === 0) return 0;
    const result = await db.delete(webhookLogs).where(
      inArray(webhookLogs.shipmentId, shipmentIds)
    );
    return result.rowCount ?? 0;
  }

  async deleteAllWebhookLogs(): Promise<number> {
    const result = await db.delete(webhookLogs);
    return result.rowCount ?? 0;
  }

  async createCargoesFlowPost(post: InsertCargoesFlowPost): Promise<CargoesFlowPost> {
    const result = await db.insert(cargoesFlowPosts).values(post).returning();
    return result[0];
  }

  async getCargoesFlowPosts(
    params: PaginationParams = { page: 1, pageSize: 50 },
    filters?: { search?: string }
  ): Promise<PaginatedResult<CargoesFlowPost>> {
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${cargoesFlowPosts.shipmentReference} ILIKE ${searchTerm}`,
          sql`${cargoesFlowPosts.mblNumber} ILIKE ${searchTerm}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(cargoesFlowPosts)
        .where(whereClause),
      db.select()
        .from(cargoesFlowPosts)
        .where(whereClause)
        .orderBy(desc(cargoesFlowPosts.postedAt))
        .limit(pageSize)
        .offset(offset)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCargoesFlowPostById(id: string): Promise<CargoesFlowPost | undefined> {
    const result = await db.select().from(cargoesFlowPosts).where(eq(cargoesFlowPosts.id, id));
    return result[0];
  }

  async getCargoesFlowPostByReference(shipmentReference: string): Promise<CargoesFlowPost | undefined> {
    const result = await db.select().from(cargoesFlowPosts).where(eq(cargoesFlowPosts.shipmentReference, shipmentReference));
    return result[0];
  }

  async getCargoesFlowPostByMbl(mblNumber: string): Promise<CargoesFlowPost | undefined> {
    const result = await db.select().from(cargoesFlowPosts)
      .where(eq(cargoesFlowPosts.mblNumber, mblNumber))
      .orderBy(desc(cargoesFlowPosts.postedAt))
      .limit(1);
    return result[0];
  }

  async updateCargoesFlowPostStatus(
    id: string,
    status: string,
    responseData?: any,
    errorMessage?: string
  ): Promise<CargoesFlowPost | undefined> {
    const result = await db.update(cargoesFlowPosts)
      .set({ status, responseData, errorMessage })
      .where(eq(cargoesFlowPosts.id, id))
      .returning();
    return result[0];
  }

  async createMissingMblShipment(shipment: InsertMissingMblShipment): Promise<MissingMblShipment> {
    const result = await db.insert(missingMblShipments).values(shipment).returning();
    return result[0];
  }

  async getMissingMblShipments(
    params: PaginationParams = { page: 1, pageSize: 50 },
    filters?: { search?: string }
  ): Promise<PaginatedResult<MissingMblShipment>> {
    const { page, pageSize } = params;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (filters?.search && filters.search.trim() !== '') {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${missingMblShipments.shipmentReference} ILIKE ${searchTerm}`,
          sql`${missingMblShipments.containerNumber} ILIKE ${searchTerm}`,
          sql`${missingMblShipments.carrier} ILIKE ${searchTerm}`,
          sql`${missingMblShipments.shipper} ILIKE ${searchTerm}`,
          sql`${missingMblShipments.consignee} ILIKE ${searchTerm}`
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(missingMblShipments)
        .where(whereClause),
      db.select()
        .from(missingMblShipments)
        .where(whereClause)
        .orderBy(desc(missingMblShipments.receivedAt))
        .limit(pageSize)
        .offset(offset)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getMissingMblShipmentByReference(shipmentReference: string): Promise<MissingMblShipment | undefined> {
    const result = await db.select().from(missingMblShipments).where(eq(missingMblShipments.shipmentReference, shipmentReference));
    return result[0];
  }

  async deleteMissingMblShipment(id: string): Promise<boolean> {
    const result = await db.delete(missingMblShipments)
      .where(eq(missingMblShipments.id, id))
      .returning();
    return result.length > 0;
  }

  // Cargoes Flow Shipments Methods
  async upsertCargoesFlowShipment(shipment: InsertCargoesFlowShipment): Promise<CargoesFlowShipment> {
    // Use containerNumber as the unique key to prevent duplicates when shipmentReference changes
    // If no containerNumber, fall back to shipmentReference
    const existing = shipment.containerNumber 
      ? await this.getCargoesFlowShipmentByContainer(shipment.containerNumber)
      : await this.getCargoesFlowShipmentByReference(shipment.shipmentReference);
    
    if (existing) {
      // Update existing record (keeping the same ID)
      const result = await db.update(cargoesFlowShipments)
        .set({ 
          ...shipment, 
          lastFetchedAt: new Date(),
          updatedAt: new Date() 
        })
        .where(eq(cargoesFlowShipments.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(cargoesFlowShipments)
        .values(shipment)
        .returning();
      return result[0];
    }
  }

  async getCargoesFlowShipments(
    params?: PaginationParams,
    filters?: ShipmentFilters & { search?: string; userName?: string; userOffice?: string; userRole?: string }
  ): Promise<PaginatedResult<CargoesFlowShipment>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (filters?.search) {
      const searchLower = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${cargoesFlowShipments.shipmentReference})`, searchLower),
          like(sql`LOWER(${cargoesFlowShipments.mblNumber})`, searchLower),
          like(sql`LOWER(${cargoesFlowShipments.containerNumber})`, searchLower),
          like(sql`LOWER(${cargoesFlowShipments.bookingNumber})`, searchLower)
        )!
      );
    }

    if (filters?.status) {
      conditions.push(eq(cargoesFlowShipments.status, filters.status));
    }

    if (filters?.carrier) {
      conditions.push(like(sql`LOWER(${cargoesFlowShipments.carrier})`, `%${filters.carrier.toLowerCase()}%`));
    }

    if (filters?.originPort) {
      conditions.push(like(sql`LOWER(${cargoesFlowShipments.originPort})`, `%${filters.originPort.toLowerCase()}%`));
    }

    if (filters?.destinationPort) {
      conditions.push(like(sql`LOWER(${cargoesFlowShipments.destinationPort})`, `%${filters.destinationPort.toLowerCase()}%`));
    }

    // Role-based filtering
    if (filters?.userRole === 'User' && filters?.userName) {
      // User role: filter by name matching salesRepNames array
      conditions.push(sql`${filters.userName} = ANY(${cargoesFlowShipments.salesRepNames})`);
    } else if (filters?.userRole === 'Manager' && filters?.userOffice) {
      // Manager role: filter by office matching office field
      conditions.push(eq(cargoesFlowShipments.office, filters.userOffice));
    }
    // Admin role: no filtering (no conditions added)

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(cargoesFlowShipments)
        .where(whereClause),
      db.select()
        .from(cargoesFlowShipments)
        .where(whereClause)
        .orderBy(desc(cargoesFlowShipments.lastFetchedAt))
        .limit(pageSize)
        .offset(offset)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getGroupedCargoesFlowShipments(
    params?: PaginationParams,
    filters?: ShipmentFilters & { search?: string; userName?: string; userOffice?: string; userRole?: string }
  ): Promise<PaginatedResult<any>> {
    const conditions: SQL[] = [];

    if (filters?.search) {
      const searchLower = `%${filters.search.toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${cargoesFlowShipments.shipmentReference})`, searchLower),
          like(sql`LOWER(${cargoesFlowShipments.mblNumber})`, searchLower),
          like(sql`LOWER(${cargoesFlowShipments.containerNumber})`, searchLower),
          like(sql`LOWER(${cargoesFlowShipments.bookingNumber})`, searchLower)
        )!
      );
    }

    if (filters?.status) {
      conditions.push(eq(cargoesFlowShipments.status, filters.status));
    }

    if (filters?.carrier) {
      conditions.push(like(sql`LOWER(${cargoesFlowShipments.carrier})`, `%${filters.carrier.toLowerCase()}%`));
    }

    if (filters?.originPort) {
      conditions.push(like(sql`LOWER(${cargoesFlowShipments.originPort})`, `%${filters.originPort.toLowerCase()}%`));
    }

    if (filters?.destinationPort) {
      conditions.push(like(sql`LOWER(${cargoesFlowShipments.destinationPort})`, `%${filters.destinationPort.toLowerCase()}%`));
    }

    // Role-based filtering
    if (filters?.userRole === 'User' && filters?.userName) {
      conditions.push(sql`${filters.userName} = ANY(${cargoesFlowShipments.salesRepNames})`);
    } else if (filters?.userRole === 'Manager' && filters?.userOffice) {
      conditions.push(eq(cargoesFlowShipments.office, filters.userOffice));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch all matching shipments
    const allShipments = await db.select()
      .from(cargoesFlowShipments)
      .where(whereClause)
      .orderBy(desc(cargoesFlowShipments.lastFetchedAt));

    // Group by MBL number
    const grouped = new Map<string, any>();
    
    for (const shipment of allShipments) {
      const mbl = shipment.mblNumber || 'NO_MBL';
      
      if (!grouped.has(mbl)) {
        // First shipment for this MBL - create the group
        const rawData = shipment.rawData as any || {};
        const riskLevel = rawData.riskLevel || 'low';
        const riskReasons = rawData.riskReasons || [];
        
        grouped.set(mbl, {
          ...shipment,
          containers: [{
            containerNumber: shipment.containerNumber,
            shipmentReference: shipment.shipmentReference,
            id: shipment.id,
          }],
          containerCount: 1,
          allContainerNumbers: [shipment.containerNumber].filter(Boolean),
          highestRiskLevel: riskLevel,
          aggregatedRiskReasons: riskReasons,
        });
      } else {
        // Add container to existing group
        const group = grouped.get(mbl)!;
        group.containers.push({
          containerNumber: shipment.containerNumber,
          shipmentReference: shipment.shipmentReference,
          id: shipment.id,
        });
        group.containerCount++;
        if (shipment.containerNumber) {
          group.allContainerNumbers.push(shipment.containerNumber);
        }
        
        // Update risk level to highest
        const currentRawData = shipment.rawData as any || {};
        const currentRisk = currentRawData.riskLevel || 'low';
        const riskOrder: Record<string, number> = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        if (riskOrder[currentRisk] > riskOrder[group.highestRiskLevel]) {
          group.highestRiskLevel = currentRisk;
        }
        
        // Aggregate risk reasons (deduplicate)
        const reasons = currentRawData.riskReasons || [];
        const allReasons = [...group.aggregatedRiskReasons, ...reasons];
        group.aggregatedRiskReasons = Array.from(new Set(allReasons));
      }
    }

    // Convert map to array and apply pagination
    const groupedArray = Array.from(grouped.values());
    const total = groupedArray.length;
    
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const offset = (page - 1) * pageSize;
    
    const paginatedData = groupedArray.slice(offset, offset + pageSize);

    return {
      data: paginatedData,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCargoesFlowShipmentById(id: string): Promise<CargoesFlowShipment | undefined> {
    const result = await db.select().from(cargoesFlowShipments).where(eq(cargoesFlowShipments.id, id));
    return result[0];
  }

  async getCargoesFlowShipmentByReference(shipmentReference: string): Promise<CargoesFlowShipment | undefined> {
    const result = await db.select().from(cargoesFlowShipments).where(eq(cargoesFlowShipments.shipmentReference, shipmentReference));
    return result[0];
  }

  async getCargoesFlowShipmentByContainer(containerNumber: string): Promise<CargoesFlowShipment | undefined> {
    const result = await db.select().from(cargoesFlowShipments).where(eq(cargoesFlowShipments.containerNumber, containerNumber));
    return result[0];
  }

  async getCargoesFlowShipmentByContainerInRawData(containerNumber: string): Promise<CargoesFlowShipment | undefined> {
    // Search for shipments where the container number exists in rawData.containers array
    const result = await db.select()
      .from(cargoesFlowShipments)
      .where(
        sql`${cargoesFlowShipments.rawData} IS NOT NULL 
          AND ${cargoesFlowShipments.rawData}->'containers' IS NOT NULL
          AND EXISTS (
            SELECT 1 
            FROM jsonb_array_elements(${cargoesFlowShipments.rawData}->'containers') AS container
            WHERE container->>'containerNumber' = ${containerNumber}
          )`
      )
      .limit(1);
    return result[0];
  }

  async getCargoesFlowShipmentByMbl(mblNumber: string): Promise<CargoesFlowShipment | undefined> {
    const result = await db.select().from(cargoesFlowShipments).where(eq(cargoesFlowShipments.mblNumber, mblNumber));
    return result[0];
  }

  async getAllCargoesFlowShipmentsByMbl(mblNumber: string): Promise<CargoesFlowShipment[]> {
    const result = await db.select().from(cargoesFlowShipments).where(eq(cargoesFlowShipments.mblNumber, mblNumber));
    return result;
  }

  async getTaiShipmentIdByMbl(mblNumber: string): Promise<string | null> {
    const result = await db.select({ taiShipmentId: cargoesFlowPosts.taiShipmentId })
      .from(cargoesFlowPosts)
      .where(eq(cargoesFlowPosts.mblNumber, mblNumber))
      .orderBy(desc(cargoesFlowPosts.postedAt))
      .limit(1);
    return result[0]?.taiShipmentId || null;
  }

  async updateCargoesFlowShipment(id: string, shipmentUpdate: Partial<InsertCargoesFlowShipment>): Promise<CargoesFlowShipment | undefined> {
    const result = await db.update(cargoesFlowShipments)
      .set({ ...shipmentUpdate, updatedAt: new Date() })
      .where(eq(cargoesFlowShipments.id, id))
      .returning();
    return result[0];
  }

  async deleteCargoesFlowShipment(id: string): Promise<boolean> {
    const result = await db.delete(cargoesFlowShipments)
      .where(eq(cargoesFlowShipments.id, id))
      .returning();
    return result.length > 0;
  }

  async getCargoesFlowShipmentUsers(shipmentId: string): Promise<CargoesFlowShipmentUser[]> {
    return await db.select().from(cargoesFlowShipmentUsers)
      .where(eq(cargoesFlowShipmentUsers.shipmentId, shipmentId))
      .orderBy(asc(cargoesFlowShipmentUsers.createdAt));
  }

  async setCargoesFlowShipmentUsers(shipmentId: string, userIds: string[]): Promise<void> {
    await db.delete(cargoesFlowShipmentUsers).where(eq(cargoesFlowShipmentUsers.shipmentId, shipmentId));
    
    if (userIds.length > 0) {
      const values = userIds.map(userId => ({ shipmentId, userId }));
      await db.insert(cargoesFlowShipmentUsers).values(values);
    }
  }

  async getContainers(shipmentId: string): Promise<Container[]> {
    return await db.select().from(containers)
      .where(eq(containers.shipmentId, shipmentId))
      .orderBy(asc(containers.createdAt));
  }

  // Cargoes Flow Sync Logs Methods
  async createCargoesFlowSyncLog(log: InsertCargoesFlowSyncLog): Promise<CargoesFlowSyncLog> {
    const result = await db.insert(cargoesFlowSyncLogs)
      .values(log)
      .returning();
    return result[0];
  }

  async getCargoesFlowSyncLogs(params?: PaginationParams): Promise<PaginatedResult<CargoesFlowSyncLog>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const offset = (page - 1) * pageSize;

    const [totalResult, data] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(cargoesFlowSyncLogs),
      db.select()
        .from(cargoesFlowSyncLogs)
        .orderBy(desc(cargoesFlowSyncLogs.createdAt))
        .limit(pageSize)
        .offset(offset)
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getLatestCargoesFlowSyncLog(): Promise<CargoesFlowSyncLog | undefined> {
    const result = await db.select()
      .from(cargoesFlowSyncLogs)
      .orderBy(desc(cargoesFlowSyncLogs.createdAt))
      .limit(1);
    return result[0];
  }

  // Cargoes Flow Update Logs Methods
  async createCargoesFlowUpdateLog(log: InsertCargoesFlowUpdateLog): Promise<CargoesFlowUpdateLog> {
    const result = await db.insert(cargoesFlowUpdateLogs)
      .values(log)
      .returning();
    return result[0];
  }

  async getCargoesFlowUpdateLogs(
    params?: PaginationParams,
    filters?: { search?: string }
  ): Promise<PaginatedResult<CargoesFlowUpdateLog>> {
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 25;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (filters?.search) {
      conditions.push(
        or(
          like(cargoesFlowUpdateLogs.shipmentNumber, `%${filters.search}%`),
          like(cargoesFlowUpdateLogs.shipmentReference, `%${filters.search}%`),
          like(cargoesFlowUpdateLogs.taiShipmentId, `%${filters.search}%`)
        )!
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(cargoesFlowUpdateLogs)
      .where(whereClause)
      .orderBy(desc(cargoesFlowUpdateLogs.createdAt))
      .limit(pageSize)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cargoesFlowUpdateLogs)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCargoesFlowUpdateLogById(id: string): Promise<CargoesFlowUpdateLog | undefined> {
    const result = await db.select()
      .from(cargoesFlowUpdateLogs)
      .where(eq(cargoesFlowUpdateLogs.id, id));
    return result[0];
  }

  async createCargoesFlowMapLog(insertLog: InsertCargoesFlowMapLog): Promise<CargoesFlowMapLog> {
    const result = await db.insert(cargoesFlowMapLogs).values(insertLog).returning();
    return result[0];
  }

  async getCargoesFlowMapLogsByShipmentNumber(shipmentNumber: string, limit: number = 50): Promise<CargoesFlowMapLog[]> {
    return await db.select()
      .from(cargoesFlowMapLogs)
      .where(eq(cargoesFlowMapLogs.shipmentNumber, shipmentNumber))
      .orderBy(desc(cargoesFlowMapLogs.createdAt))
      .limit(limit);
  }

  async createShipmentDocument(insertDocument: InsertShipmentDocument): Promise<ShipmentDocument> {
    const result = await db.insert(shipmentDocuments).values(insertDocument).returning();
    return result[0];
  }

  async getShipmentDocuments(shipmentId: string): Promise<ShipmentDocument[]> {
    return await db.select()
      .from(shipmentDocuments)
      .where(eq(shipmentDocuments.shipmentId, shipmentId))
      .orderBy(desc(shipmentDocuments.uploadedAt));
  }

  async getShipmentDocumentById(id: string): Promise<ShipmentDocument | undefined> {
    const result = await db.select()
      .from(shipmentDocuments)
      .where(eq(shipmentDocuments.id, id));
    return result[0];
  }

  async deleteShipmentDocument(id: string): Promise<boolean> {
    const result = await db.delete(shipmentDocuments)
      .where(eq(shipmentDocuments.id, id))
      .returning();
    return result.length > 0;
  }

  async createCargoesFlowDocumentUpload(insertUpload: InsertCargoesFlowDocumentUpload): Promise<CargoesFlowDocumentUpload> {
    const result = await db.insert(cargoesFlowDocumentUploads).values(insertUpload).returning();
    return result[0];
  }

  async getCargoesFlowDocumentUploads(params?: PaginationParams, filters?: { shipmentNumber?: string; uploadStatus?: string }): Promise<PaginatedResult<CargoesFlowDocumentUpload>> {
    const { page = 1, pageSize = 50 } = params || {};
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [];

    if (filters?.shipmentNumber) {
      conditions.push(like(cargoesFlowDocumentUploads.shipmentNumber, `%${filters.shipmentNumber}%`));
    }

    if (filters?.uploadStatus) {
      conditions.push(eq(cargoesFlowDocumentUploads.uploadStatus, filters.uploadStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await db
      .select()
      .from(cargoesFlowDocumentUploads)
      .where(whereClause)
      .orderBy(desc(cargoesFlowDocumentUploads.uploadedAt))
      .limit(pageSize)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cargoesFlowDocumentUploads)
      .where(whereClause);

    const total = countResult[0]?.count || 0;

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCargoesFlowDocumentUploadById(id: string): Promise<CargoesFlowDocumentUpload | undefined> {
    const result = await db.select()
      .from(cargoesFlowDocumentUploads)
      .where(eq(cargoesFlowDocumentUploads.id, id));
    return result[0];
  }

  async updateCargoesFlowDocumentUploadStatus(
    id: string,
    status: string,
    errorMessage?: string,
    cargoesFlowCreatedAt?: Date
  ): Promise<CargoesFlowDocumentUpload | undefined> {
    const updateData: any = { uploadStatus: status };
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (cargoesFlowCreatedAt) updateData.cargoesFlowCreatedAt = cargoesFlowCreatedAt;

    const result = await db
      .update(cargoesFlowDocumentUploads)
      .set(updateData)
      .where(eq(cargoesFlowDocumentUploads.id, id))
      .returning();
    return result[0];
  }

  async createCargoesFlowDocumentUploadLog(insertLog: InsertCargoesFlowDocumentUploadLog): Promise<CargoesFlowDocumentUploadLog> {
    const result = await db.insert(cargoesFlowDocumentUploadLogs).values(insertLog).returning();
    return result[0];
  }

  async getCargoesFlowDocumentUploadLogs(params?: PaginationParams): Promise<PaginatedResult<CargoesFlowDocumentUploadLog>> {
    const { page = 1, pageSize = 50 } = params || {};
    const offset = (page - 1) * pageSize;

    const data = await db
      .select()
      .from(cargoesFlowDocumentUploadLogs)
      .orderBy(desc(cargoesFlowDocumentUploadLogs.uploadStartedAt))
      .limit(pageSize)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cargoesFlowDocumentUploadLogs);

    const total = countResult[0]?.count || 0;

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getCargoesFlowDocumentUploadLogById(id: string): Promise<CargoesFlowDocumentUploadLog | undefined> {
    const result = await db.select()
      .from(cargoesFlowDocumentUploadLogs)
      .where(eq(cargoesFlowDocumentUploadLogs.id, id));
    return result[0];
  }

  async updateCargoesFlowDocumentUploadLogStatus(
    id: string,
    successCount: number,
    failCount: number,
    completedAt: Date,
    apiResponse?: string,
    errorDetails?: string
  ): Promise<CargoesFlowDocumentUploadLog | undefined> {
    const updateData: any = {
      successfulUploads: successCount,
      failedUploads: failCount,
      uploadCompletedAt: completedAt,
    };
    if (apiResponse) updateData.apiResponse = apiResponse;
    if (errorDetails) updateData.errorDetails = errorDetails;

    const result = await db
      .update(cargoesFlowDocumentUploadLogs)
      .set(updateData)
      .where(eq(cargoesFlowDocumentUploadLogs.id, id))
      .returning();
    return result[0];
  }

  async getDistinctCarriers(): Promise<string[]> {
    const result = await db
      .selectDistinct({ carrier: cargoesFlowShipments.carrier })
      .from(cargoesFlowShipments)
      .where(sql`${cargoesFlowShipments.carrier} IS NOT NULL AND ${cargoesFlowShipments.carrier} != ''`);
    
    return result
      .map(row => row.carrier)
      .filter((carrier): carrier is string => carrier !== null && carrier !== undefined)
      .sort();
  }

  async getDistinctPorts(): Promise<string[]> {
    const origins = await db
      .selectDistinct({ port: cargoesFlowShipments.originPort })
      .from(cargoesFlowShipments)
      .where(sql`${cargoesFlowShipments.originPort} IS NOT NULL AND ${cargoesFlowShipments.originPort} != ''`);
    
    const destinations = await db
      .selectDistinct({ port: cargoesFlowShipments.destinationPort })
      .from(cargoesFlowShipments)
      .where(sql`${cargoesFlowShipments.destinationPort} IS NOT NULL AND ${cargoesFlowShipments.destinationPort} != ''`);
    
    const allPorts = [
      ...origins.map(row => row.port),
      ...destinations.map(row => row.port)
    ]
      .filter((port): port is string => port !== null && port !== undefined);
    
    // Normalize and deduplicate port names
    const normalizedPorts = this.normalizePortNames(allPorts);
    const uniquePorts = Array.from(new Set(normalizedPorts));
    return uniquePorts.sort();
  }

  // Helper function to normalize port names and remove duplicates
  private normalizePortNames(ports: string[]): string[] {
    const portMapping: { [key: string]: string } = {
      // New York variations
      'new york city': 'New York',
      'new york': 'New York',
      'nyc': 'New York',
      'new york, ny': 'New York',
      
      // Karachi/Pakistan port variations
      'karachi': 'Karachi',
      'kemari': 'Karachi',
      'muhammad bin qasim': 'Karachi',
      'bin qasim': 'Karachi',
      'bin qasim port': 'Karachi',
      'port qasim': 'Karachi',
      'port muhammad bin qasim': 'Karachi',
      
      // Los Angeles variations
      'los angeles': 'Los Angeles',
      'la': 'Los Angeles',
      'los angeles, ca': 'Los Angeles',
      
      // Long Beach variations
      'long beach': 'Long Beach',
      'long beach, ca': 'Long Beach',
      
      // Shanghai variations
      'shanghai': 'Shanghai',
      'shanghai, china': 'Shanghai',
      
      // Houston variations
      'houston': 'Houston',
      'houston, tx': 'Houston',
      
      // Oakland variations
      'oakland': 'Oakland',
      'oakland, ca': 'Oakland',
      
      // Seattle variations
      'seattle': 'Seattle',
      'seattle, wa': 'Seattle',
      
      // Savannah variations
      'savannah': 'Savannah',
      'savannah, ga': 'Savannah',
      
      // Norfolk variations
      'norfolk': 'Norfolk',
      'norfolk, va': 'Norfolk',
      
      // Charleston variations
      'charleston': 'Charleston',
      'charleston, sc': 'Charleston',
    };
    
    return ports.map(port => {
      const normalized = port.toLowerCase().trim();
      return portMapping[normalized] || port;
    });
  }
}

export const storage = new DbStorage();
