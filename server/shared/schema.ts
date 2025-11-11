import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username"),
  password: text("password"),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("User"),
  office: text("office").notNull().default("Logistics Sales-Domestic Operations"),
  googleId: text("google_id").unique(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: varchar("entity_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Notifications table for real-time alerts
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  type: text("type").notNull(), // STATUS_CHANGE, EXCEPTION, DEMURRAGE_ALERT, CUSTOMS_HOLD, ARRIVAL, DELAY
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityType: text("entity_type"), // CONTAINER, SHIPMENT
  entityId: varchar("entity_id"),
  metadata: jsonb("metadata"), // Additional data like container number, old status, new status
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // shipper, consignee, both
  address: text("address"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;

export const shipments = pgTable("shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referenceNumber: text("reference_number").notNull().unique(),
  bookingNumber: text("booking_number").notNull(),
  masterBillOfLading: text("master_bill_of_landing").notNull(),
  shipper: text("shipper"),
  consignee: text("consignee"),
  shipperId: varchar("shipper_id").references(() => organizations.id),
  consigneeId: varchar("consignee_id").references(() => organizations.id),
  originPort: text("origin_port").notNull(),
  destinationPort: text("destination_port").notNull(),
  etd: text("etd"),
  eta: text("eta"),
  atd: text("atd"),
  ata: text("ata"),
  status: text("status").notNull().default("planned"),
  carrier: text("carrier"),
  scacCode: text("scac_code"),
  vesselName: text("vessel_name"),
  voyageNumber: text("voyage_number"),
  source: text("source").notNull().default("user"), // 'user', 'webhook', 'api'
  officeName: text("office_name"),
  salesRepNames: text("sales_rep_names").array(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipmentUsers = pgTable("shipment_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shipmentsRelations = relations(shipments, ({ many, one }) => ({
  containers: many(containers),
  milestones: many(milestones),
  shipmentUsers: many(shipmentUsers),
  creator: one(users, {
    fields: [shipments.createdBy],
    references: [users.id],
  }),
  shipperOrganization: one(organizations, {
    fields: [shipments.shipperId],
    references: [organizations.id],
  }),
  consigneeOrganization: one(organizations, {
    fields: [shipments.consigneeId],
    references: [organizations.id],
  }),
}));

export const shipmentUsersRelations = relations(shipmentUsers, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentUsers.shipmentId],
    references: [shipments.id],
  }),
  user: one(users, {
    fields: [shipmentUsers.userId],
    references: [users.id],
  }),
}));

export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(),
  location: text("location"),
  timestampPlanned: text("timestamp_planned"),
  timestampActual: text("timestamp_actual"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const milestonesRelations = relations(milestones, ({ one }) => ({
  shipment: one(shipments, {
    fields: [milestones.shipmentId],
    references: [shipments.id],
  }),
}));

export const containers = pgTable("containers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => shipments.id, { onDelete: "cascade" }),
  containerNumber: text("container_number").notNull().unique(),
  containerType: text("container_type").notNull().default("40HC"),
  status: text("status").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  carrier: text("carrier").notNull(),
  scacCode: text("scac_code"),
  vesselName: text("vessel_name").notNull(),
  bookingNumber: text("booking_number").notNull(),
  masterBillOfLading: text("master_bill_of_landing").notNull(),
  weight: text("weight").notNull(),
  volume: text("volume").notNull(),
  eta: text("eta").notNull(),
  estimatedArrival: text("estimated_arrival").notNull(),
  progress: integer("progress").notNull(),
  reference: text("reference"),
  podTerminal: text("pod_terminal"),
  holdTypes: text("hold_types").array(),
  riskLevel: text("risk_level"),
  riskReason: text("risk_reason"),
  terminalStatus: text("terminal_status"),
  lastFreeDay: text("last_free_day"),
  demurrageFee: decimal("demurrage_fee"),
  dailyFeeRate: decimal("daily_fee_rate").default("150"),
  detentionFee: decimal("detention_fee").default("0"),
  freightCost: decimal("freight_cost").default("0"),
  exceptionCost: decimal("exception_cost").default("0"),
  pickupChassis: text("pickup_chassis"),
  yardLocation: text("yard_location"),
  pickupAppointment: text("pickup_appointment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const containersRelations = relations(containers, ({ many, one }) => ({
  shipment: one(shipments, {
    fields: [containers.shipmentId],
    references: [shipments.id],
  }),
  exceptions: many(exceptions),
  vesselPosition: many(vesselPositions),
  railSegments: many(railSegments),
  timelineEvents: many(timelineEvents),
}));

export const exceptions = pgTable("exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").notNull().references(() => containers.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  timestamp: text("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exceptionsRelations = relations(exceptions, ({ one }) => ({
  container: one(containers, {
    fields: [exceptions.containerId],
    references: [containers.id],
  }),
}));

export const vesselPositions = pgTable("vessel_positions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").notNull().references(() => containers.id, { onDelete: "cascade" }),
  latitude: decimal("latitude").notNull(),
  longitude: decimal("longitude").notNull(),
  speed: decimal("speed").notNull(),
  course: decimal("course").notNull(),
  timestamp: text("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vesselPositionsRelations = relations(vesselPositions, ({ one }) => ({
  container: one(containers, {
    fields: [vesselPositions.containerId],
    references: [containers.id],
  }),
}));

export const railSegments = pgTable("rail_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").notNull().references(() => containers.id, { onDelete: "cascade" }),
  carrier: text("carrier").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  departureTime: text("departure_time"),
  arrivalTime: text("arrival_time"),
  estimatedArrival: text("estimated_arrival"),
  status: text("status").notNull(),
  trainNumber: text("train_number"),
  lastFreeDay: text("last_free_day"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const railSegmentsRelations = relations(railSegments, ({ one }) => ({
  container: one(containers, {
    fields: [railSegments.containerId],
    references: [containers.id],
  }),
}));

export const timelineEvents = pgTable("timeline_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  containerId: varchar("container_id").notNull().references(() => containers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  location: text("location").notNull(),
  timestamp: text("timestamp").notNull(),
  completed: boolean("completed").notNull(),
  isCurrent: boolean("is_current").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timelineEventsRelations = relations(timelineEvents, ({ one }) => ({
  container: one(containers, {
    fields: [timelineEvents.containerId],
    references: [containers.id],
  }),
}));

export const savedViews = pgTable("saved_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  filters: jsonb("filters").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customEntries = pgTable("custom_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // 'carrier', 'port', 'terminal'
  value: text("value").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShipmentUserSchema = createInsertSchema(shipmentUsers).omit({
  id: true,
  createdAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContainerSchema = createInsertSchema(containers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  bookingNumber: z.string().optional(),
  weight: z.string().optional(),
  volume: z.string().optional(),
  estimatedArrival: z.string().optional(),
  progress: z.number().optional(),
  status: z.string().optional(),
  origin: z.string().optional(),
  destination: z.string().optional(),
  carrier: z.string().optional(),
  vesselName: z.string().optional(),
  masterBillOfLading: z.string().optional(),
  eta: z.string().optional(),
});

export const insertExceptionSchema = createInsertSchema(exceptions).omit({
  id: true,
  createdAt: true,
});

export const insertVesselPositionSchema = createInsertSchema(vesselPositions).omit({
  id: true,
  createdAt: true,
});

export const insertRailSegmentSchema = createInsertSchema(railSegments).omit({
  id: true,
  createdAt: true,
});

export const insertTimelineEventSchema = createInsertSchema(timelineEvents).omit({
  id: true,
  createdAt: true,
});

export const insertSavedViewSchema = createInsertSchema(savedViews).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const integrationConfigs = pgTable("integration_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  carrier: text("carrier").notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  apiKeyName: text("api_key_name"),
  isActive: boolean("is_active").default(true),
  pollingIntervalMinutes: integer("polling_interval_minutes").default(60),
  webhookSecret: text("webhook_secret"),
  lastSyncAt: timestamp("last_sync_at"),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const integrationSyncLogs = pgTable("integration_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").notNull().references(() => integrationConfigs.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  recordsProcessed: integer("records_processed").default(0),
  recordsUpdated: integer("records_updated").default(0),
  recordsFailed: integer("records_failed").default(0),
  errorMessage: text("error_message"),
  syncDurationMs: integer("sync_duration_ms"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const carrierUpdates = pgTable("carrier_updates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  integrationId: varchar("integration_id").notNull().references(() => integrationConfigs.id, { onDelete: "cascade" }),
  containerNumber: text("container_number").notNull(),
  carrier: text("carrier").notNull(),
  updateType: text("update_type").notNull(),
  status: text("status"),
  location: text("location"),
  timestamp: text("timestamp").notNull(),
  rawData: jsonb("raw_data"),
  processed: boolean("processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const integrationConfigsRelations = relations(integrationConfigs, ({ many }) => ({
  syncLogs: many(integrationSyncLogs),
  carrierUpdates: many(carrierUpdates),
}));

export const integrationSyncLogsRelations = relations(integrationSyncLogs, ({ one }) => ({
  integration: one(integrationConfigs, {
    fields: [integrationSyncLogs.integrationId],
    references: [integrationConfigs.id],
  }),
}));

export const carrierUpdatesRelations = relations(carrierUpdates, ({ one }) => ({
  integration: one(integrationConfigs, {
    fields: [carrierUpdates.integrationId],
    references: [integrationConfigs.id],
  }),
}));

export const insertIntegrationConfigSchema = createInsertSchema(integrationConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIntegrationSyncLogSchema = createInsertSchema(integrationSyncLogs).omit({
  id: true,
  createdAt: true,
});

export const insertCarrierUpdateSchema = createInsertSchema(carrierUpdates).omit({
  id: true,
  createdAt: true,
});

export const insertCustomEntrySchema = createInsertSchema(customEntries).omit({
  id: true,
  createdAt: true,
});

export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type Shipment = typeof shipments.$inferSelect;
export type InsertShipmentUser = z.infer<typeof insertShipmentUserSchema>;
export type ShipmentUser = typeof shipmentUsers.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertContainer = z.infer<typeof insertContainerSchema>;
export type Container = typeof containers.$inferSelect;
export type InsertException = z.infer<typeof insertExceptionSchema>;
export type Exception = typeof exceptions.$inferSelect;
export type InsertVesselPosition = z.infer<typeof insertVesselPositionSchema>;
export type VesselPosition = typeof vesselPositions.$inferSelect;
export type InsertRailSegment = z.infer<typeof insertRailSegmentSchema>;
export type RailSegment = typeof railSegments.$inferSelect;
export type InsertTimelineEvent = z.infer<typeof insertTimelineEventSchema>;
export type TimelineEvent = typeof timelineEvents.$inferSelect;
export type InsertSavedView = z.infer<typeof insertSavedViewSchema>;
export type SavedView = typeof savedViews.$inferSelect;
export type InsertIntegrationConfig = z.infer<typeof insertIntegrationConfigSchema>;
export type IntegrationConfig = typeof integrationConfigs.$inferSelect;
export type InsertIntegrationSyncLog = z.infer<typeof insertIntegrationSyncLogSchema>;
export type IntegrationSyncLog = typeof integrationSyncLogs.$inferSelect;
export type InsertCarrierUpdate = z.infer<typeof insertCarrierUpdateSchema>;
export type CarrierUpdate = typeof carrierUpdates.$inferSelect;
export type InsertCustomEntry = z.infer<typeof insertCustomEntrySchema>;
export type CustomEntry = typeof customEntries.$inferSelect;

// TMS Webhook Logs - for receiving real-time updates from our TMS
export const webhookLogs = pgTable("webhook_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventType: text("event_type").notNull(), // Shipment type: Drayage, Truckload, LTL, etc.
  operation: text("operation"), // CRUD operation: CREATE, UPDATE
  shipmentId: text("shipment_id"),
  containerNumber: text("container_number"),
  status: text("status"),
  rawPayload: jsonb("raw_payload").notNull(),
  processedAt: timestamp("processed_at"),
  errorMessage: text("error_message"),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWebhookLogSchema = createInsertSchema(webhookLogs).omit({
  id: true,
  receivedAt: true,
  createdAt: true,
});

export type InsertWebhookLog = z.infer<typeof insertWebhookLogSchema>;
export type WebhookLog = typeof webhookLogs.$inferSelect;

export const cargoesFlowPosts = pgTable("cargoes_flow_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentReference: text("shipment_reference").notNull(),
  taiShipmentId: text("tai_shipment_id"),
  mblNumber: text("mbl_number").notNull(),
  containerNumber: text("container_number"),
  carrier: text("carrier"),
  bookingNumber: text("booking_number"),
  webhookId: varchar("webhook_id"),
  status: text("status").notNull().default("pending"),
  responseData: jsonb("response_data"),
  errorMessage: text("error_message"),
  office: text("office"),
  salesRepNames: text("sales_rep_names").array(),
  postedAt: timestamp("posted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCargoesFlowPostSchema = createInsertSchema(cargoesFlowPosts).omit({
  id: true,
  postedAt: true,
  createdAt: true,
});

export type InsertCargoesFlowPost = z.infer<typeof insertCargoesFlowPostSchema>;
export type CargoesFlowPost = typeof cargoesFlowPosts.$inferSelect;

export const missingMblShipments = pgTable("missing_mbl_shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentReference: text("shipment_reference").notNull(),
  webhookId: varchar("webhook_id"),
  containerNumber: text("container_number"),
  shipper: text("shipper"),
  consignee: text("consignee"),
  originPort: text("origin_port"),
  destinationPort: text("destination_port"),
  carrier: text("carrier"),
  status: text("status"),
  receivedAt: timestamp("received_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMissingMblShipmentSchema = createInsertSchema(missingMblShipments).omit({
  id: true,
  receivedAt: true,
  createdAt: true,
});

export type InsertMissingMblShipment = z.infer<typeof insertMissingMblShipmentSchema>;
export type MissingMblShipment = typeof missingMblShipments.$inferSelect;

// Cargoes Flow Shipments - shipments fetched from Cargoes Flow API
export const cargoesFlowShipments = pgTable("cargoes_flow_shipments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentReference: text("shipment_reference").notNull(),
  taiShipmentId: text("tai_shipment_id"),
  mblNumber: text("mbl_number"),
  containerNumber: text("container_number"),
  bookingNumber: text("booking_number"),
  shipper: text("shipper"),
  consignee: text("consignee"),
  originPort: text("origin_port"),
  destinationPort: text("destination_port"),
  etd: text("etd"),
  eta: text("eta"),
  status: text("status"),
  carrier: text("carrier"),
  vesselName: text("vessel_name"),
  voyageNumber: text("voyage_number"),
  containerType: text("container_type"),
  office: text("office"),
  salesRepNames: text("sales_rep_names").array(),
  rawData: jsonb("raw_data"),
  lastFetchedAt: timestamp("last_fetched_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCargoesFlowShipmentSchema = createInsertSchema(cargoesFlowShipments).omit({
  id: true,
  lastFetchedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCargoesFlowShipment = z.infer<typeof insertCargoesFlowShipmentSchema>;
export type CargoesFlowShipment = typeof cargoesFlowShipments.$inferSelect;

// Cargoes Flow Shipment Users - user assignments for Cargoes Flow shipments
export const cargoesFlowShipmentUsers = pgTable("cargoes_flow_shipment_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id").notNull().references(() => cargoesFlowShipments.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cargoesFlowShipmentUsersRelations = relations(cargoesFlowShipmentUsers, ({ one }) => ({
  shipment: one(cargoesFlowShipments, {
    fields: [cargoesFlowShipmentUsers.shipmentId],
    references: [cargoesFlowShipments.id],
  }),
  user: one(users, {
    fields: [cargoesFlowShipmentUsers.userId],
    references: [users.id],
  }),
}));

export const insertCargoesFlowShipmentUserSchema = createInsertSchema(cargoesFlowShipmentUsers).omit({
  id: true,
  createdAt: true,
});

export type InsertCargoesFlowShipmentUser = z.infer<typeof insertCargoesFlowShipmentUserSchema>;
export type CargoesFlowShipmentUser = typeof cargoesFlowShipmentUsers.$inferSelect;

// Cargoes Flow Sync Logs - tracks each polling attempt
export const cargoesFlowSyncLogs = pgTable("cargoes_flow_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull(), // success, error, partial
  shipmentsProcessed: integer("shipments_processed").default(0),
  shipmentsCreated: integer("shipments_created").default(0),
  shipmentsUpdated: integer("shipments_updated").default(0),
  errorMessage: text("error_message"),
  syncDurationMs: integer("sync_duration_ms"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCargoesFlowSyncLogSchema = createInsertSchema(cargoesFlowSyncLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCargoesFlowSyncLog = z.infer<typeof insertCargoesFlowSyncLogSchema>;
export type CargoesFlowSyncLog = typeof cargoesFlowSyncLogs.$inferSelect;

// Cargoes Flow Update Logs - tracks updates sent to Cargoes Flow updateShipments API
export const cargoesFlowUpdateLogs = pgTable("cargoes_flow_update_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentNumber: text("shipment_number").notNull(),
  shipmentReference: text("shipment_reference"),
  taiShipmentId: text("tai_shipment_id"),
  webhookId: varchar("webhook_id"),
  updateData: jsonb("update_data"),
  status: text("status").notNull().default("pending"),
  responseData: jsonb("response_data"),
  errorMessage: text("error_message"),
  postedAt: timestamp("posted_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCargoesFlowUpdateLogSchema = createInsertSchema(cargoesFlowUpdateLogs).omit({
  id: true,
  postedAt: true,
  createdAt: true,
});

export type InsertCargoesFlowUpdateLog = z.infer<typeof insertCargoesFlowUpdateLogSchema>;
export type CargoesFlowUpdateLog = typeof cargoesFlowUpdateLogs.$inferSelect;

// Cargoes Flow Map Logs - tracks GET map API calls
export const cargoesFlowMapLogs = pgTable("cargoes_flow_map_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentNumber: text("shipment_number").notNull(),
  shipmentReference: text("shipment_reference"),
  requestUrl: text("request_url").notNull(),
  status: text("status").notNull(),
  statusCode: integer("status_code"),
  responseData: jsonb("response_data"),
  errorMessage: text("error_message"),
  requestDurationMs: integer("request_duration_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCargoesFlowMapLogSchema = createInsertSchema(cargoesFlowMapLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCargoesFlowMapLog = z.infer<typeof insertCargoesFlowMapLogSchema>;
export type CargoesFlowMapLog = typeof cargoesFlowMapLogs.$inferSelect;

// Shipment Documents - BOL, customs paperwork, shipping documents
export const shipmentDocuments = pgTable("shipment_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentId: varchar("shipment_id"),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  fileUrl: text("file_url"),
  fileData: text("file_data"),
  description: text("description"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertShipmentDocumentSchema = createInsertSchema(shipmentDocuments).omit({
  id: true,
  uploadedAt: true,
  createdAt: true,
});

export type InsertShipmentDocument = z.infer<typeof insertShipmentDocumentSchema>;
export type ShipmentDocument = typeof shipmentDocuments.$inferSelect;

// Cargoes Flow Document Uploads - tracks documents uploaded to Cargoes Flow
export const cargoesFlowDocumentUploads = pgTable("cargoes_flow_document_uploads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  shipmentNumber: varchar("shipment_number").notNull(),
  fileName: varchar("file_name").notNull(),
  fileExtension: varchar("file_extension"),
  fileSize: integer("file_size"),
  organizationId: varchar("organization_id"),
  organizationName: varchar("organization_name"),
  uploadStatus: varchar("upload_status").notNull().default("pending"),
  errorMessage: text("error_message"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  cargoesFlowCreatedAt: timestamp("cargoes_flow_created_at"),
});

export const insertCargoesFlowDocumentUploadSchema = createInsertSchema(cargoesFlowDocumentUploads).omit({
  id: true,
  uploadedAt: true,
});

export type InsertCargoesFlowDocumentUpload = z.infer<typeof insertCargoesFlowDocumentUploadSchema>;
export type CargoesFlowDocumentUpload = typeof cargoesFlowDocumentUploads.$inferSelect;

// Cargoes Flow Document Upload Logs - tracks bulk upload batches
export const cargoesFlowDocumentUploadLogs = pgTable("cargoes_flow_document_upload_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull(),
  totalFiles: integer("total_files").notNull(),
  successfulUploads: integer("successful_uploads").default(0),
  failedUploads: integer("failed_uploads").default(0),
  uploadStartedAt: timestamp("upload_started_at").defaultNow(),
  uploadCompletedAt: timestamp("upload_completed_at"),
  apiRequest: text("api_request"),
  apiResponse: text("api_response"),
  errorDetails: text("error_details"),
});

export const insertCargoesFlowDocumentUploadLogSchema = createInsertSchema(cargoesFlowDocumentUploadLogs).omit({
  id: true,
  uploadStartedAt: true,
});

export type InsertCargoesFlowDocumentUploadLog = z.infer<typeof insertCargoesFlowDocumentUploadLogSchema>;
export type CargoesFlowDocumentUploadLog = typeof cargoesFlowDocumentUploadLogs.$inferSelect;

// Cargoes Flow Carriers - stores carrier information from Cargoes Flow API
export const cargoesFlowCarriers = pgTable("cargoes_flow_carriers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierName: text("carrier_name").notNull(),
  carrierScac: text("carrier_scac"),
  shipmentType: text("shipment_type"), // INTERMODAL_SHIPMENT, AIR_SHIPMENT, etc.
  supportsTrackByMbl: boolean("supports_track_by_mbl").default(false),
  supportsTrackByBookingNumber: boolean("supports_track_by_booking_number").default(false),
  requiresMbl: boolean("requires_mbl").default(false),
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCargoesFlowCarrierSchema = createInsertSchema(cargoesFlowCarriers).omit({
  id: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCargoesFlowCarrier = z.infer<typeof insertCargoesFlowCarrierSchema>;
export type CargoesFlowCarrier = typeof cargoesFlowCarriers.$inferSelect;

// Cargoes Flow Carrier Sync Logs - tracks carrier list synchronization
export const cargoesFlowCarrierSyncLogs = pgTable("cargoes_flow_carrier_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull(), // success, error
  carriersProcessed: integer("carriers_processed").default(0),
  carriersCreated: integer("carriers_created").default(0),
  carriersUpdated: integer("carriers_updated").default(0),
  errorMessage: text("error_message"),
  syncDurationMs: integer("sync_duration_ms"),
  apiRequest: text("api_request"),
  apiResponse: text("api_response"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCargoesFlowCarrierSyncLogSchema = createInsertSchema(cargoesFlowCarrierSyncLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertCargoesFlowCarrierSyncLog = z.infer<typeof insertCargoesFlowCarrierSyncLogSchema>;
export type CargoesFlowCarrierSyncLog = typeof cargoesFlowCarrierSyncLogs.$inferSelect;
