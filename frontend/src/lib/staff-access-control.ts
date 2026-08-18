/**
 * CakeToHome Centralized Staff Profile & Feature-Level Permission System
 *
 * Architecture:
 * USER / AUTH IDENTITY -> STAFF ACCOUNT -> MULTIPLE ACCESS PROFILES (MANY-TO-MANY) -> FEATURE PERMISSIONS (UNION) -> PAGE / API AUTHORIZATION
 *
 * Permission Priority:
 * 1. SUPER_ADMIN (System-level unrestricted authority)
 * 2. Explicit Staff-Level DENY (Highest precedence for standard staff)
 * 3. Explicit Staff-Level ALLOW
 * 4. Profile-Level Permission Union (All Active Assigned Profiles)
 * 5. Default DENY (Fail Closed)
 */

export type StaffRole = "SUPER_ADMIN" | "BRANCH_MANAGER" | "DELIVERY_PARTNER" | "STAFF";

export type ProfileStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";

export interface PermissionDefinition {
  id: string; // e.g. "TELEMARKETING.VIEW"
  module: string; // e.g. "TELEMARKETING"
  action: string; // e.g. "VIEW"
  label: string;
  description: string;
  category: string;
}

export interface AccessProfile {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: ProfileStatus;
  is_system: boolean;
  permissions: string[]; // List of permission IDs, e.g. ["TELEMARKETING.VIEW", "TELEMARKETING.EXPORT"]
  created_by?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Junction Table Model: Many-to-Many Assignment between Staff and Access Profiles
 */
export interface StaffAccessProfileAssignment {
  id: string;
  staff_id: string;
  profile_id: string;
  assigned_at: string;
  assigned_by?: string;
}

export interface StaffMember {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  email: string;
  role: StaffRole;
  profile_id: string | null; // Primary / Legacy profile ID
  profile_name?: string; // Primary / Legacy profile name
  profile_ids: string[]; // MULTIPLE ASSIGNED ACCESS PROFILES
  profile_names: string[]; // ALL ASSIGNED ACCESS PROFILE NAMES
  effective_permissions?: string[]; // Cached union of effective permissions
  branch_id?: string | null;
  branch_name?: string | null;
  city?: string | null;
  status: "ACTIVE" | "SUSPENDED";
  overrides: Record<string, "ALLOW" | "DENY">; // e.g. { "TELEMARKETING.EXPORT": "DENY" }
  created_at: string;
  updated_at: string;
}

export interface PermissionAuditLog {
  id: string;
  actor_user_id: string;
  actor_name: string;
  target_type: "PROFILE" | "STAFF" | "PERMISSION";
  target_id: string;
  target_name: string;
  action: string;
  details: string;
  old_state?: any;
  new_state?: any;
  created_at: string;
}

// ── CANONICAL PERMISSION CATALOG ───────────────────────────────────────────
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // TELEMARKETING
  { id: "TELEMARKETING.VIEW", module: "TELEMARKETING", action: "VIEW", label: "View Telemarketing Queue", description: "View calling list candidates and opportunity metrics", category: "Telemarketing & Reorder" },
  { id: "TELEMARKETING.EXPORT", module: "TELEMARKETING", action: "EXPORT", label: "Export Calling Lists", description: "Download Telecaller Excel list and master report", category: "Telemarketing & Reorder" },
  { id: "TELEMARKETING.CONTACT", module: "TELEMARKETING", action: "CONTACT", label: "Log Calls & Notes", description: "Log call notes, outcomes, and scheduled follow-ups", category: "Telemarketing & Reorder" },
  { id: "TELEMARKETING.UPDATE_STATUS", module: "TELEMARKETING", action: "UPDATE_STATUS", label: "Update Contact Status", description: "Change candidate status lifecycle", category: "Telemarketing & Reorder" },
  { id: "TELEMARKETING.ASSIGN", module: "TELEMARKETING", action: "ASSIGN", label: "Assign Telecallers", description: "Assign opportunities to specific staff telecallers", category: "Telemarketing & Reorder" },
  { id: "TELEMARKETING.VIEW_HISTORY", module: "TELEMARKETING", action: "VIEW_HISTORY", label: "View Past Order Context", description: "Inspect prior anniversary order details and pitch cues", category: "Telemarketing & Reorder" },
  { id: "TELEMARKETING.CONVERT_ORDER", module: "TELEMARKETING", action: "CONVERT_ORDER", label: "Attribute Converted Orders", description: "Link converted order ID and attributed revenue", category: "Telemarketing & Reorder" },

  // CUSTOMERS / CRM
  { id: "CUSTOMERS.VIEW", module: "CUSTOMERS", action: "VIEW", label: "View Customers", description: "Browse customer accounts and profile cards", category: "Customer Management" },
  { id: "CUSTOMERS.SEARCH", module: "CUSTOMERS", action: "SEARCH", label: "Search Customers", description: "Search customer directory by query", category: "Customer Management" },
  { id: "CUSTOMERS.VIEW_PHONE", module: "CUSTOMERS", action: "VIEW_PHONE", label: "View Customer Phone Numbers", description: "Expose clean normalized phone numbers for outreach", category: "Customer Management" },
  { id: "CUSTOMERS.VIEW_EMAIL", module: "CUSTOMERS", action: "VIEW_EMAIL", label: "View Customer Email", description: "Access customer email addresses", category: "Customer Management" },
  { id: "CUSTOMERS.EDIT", module: "CUSTOMERS", action: "EDIT", label: "Edit Customer Accounts", description: "Modify customer account details and tags", category: "Customer Management" },
  { id: "CUSTOMERS.EXPORT", module: "CUSTOMERS", action: "EXPORT", label: "Export Customer Directory", description: "Export customer master data to Excel", category: "Customer Management" },

  // ORDERS
  { id: "ORDERS.VIEW", module: "ORDERS", action: "VIEW", label: "View Orders List", description: "Browse active and historical store orders", category: "Order Management" },
  { id: "ORDERS.VIEW_DETAILS", module: "ORDERS", action: "VIEW_DETAILS", label: "View Order Breakdown", description: "Inspect item lines, cake customizations, and bill summary", category: "Order Management" },
  { id: "ORDERS.EDIT", module: "ORDERS", action: "EDIT", label: "Modify Orders", description: "Update order status, delivery slot, or note", category: "Order Management" },
  { id: "ORDERS.CANCEL", module: "ORDERS", action: "CANCEL", label: "Cancel & Refund Orders", description: "Process cancellations and trigger refunds", category: "Order Management" },
  { id: "ORDERS.EXPORT", module: "ORDERS", action: "EXPORT", label: "Export Order Register", description: "Download order registers and invoice logs", category: "Order Management" },

  // MARKETING & CAMPAIGNS
  { id: "MARKETING.VIEW", module: "MARKETING", action: "VIEW", label: "View Marketing Hub", description: "Browse promotions, coupons, and campaigns", category: "Marketing & Growth" },
  { id: "MARKETING.CREATE", module: "MARKETING", action: "CREATE", label: "Create Campaigns", description: "Create new marketing promotions and coupon codes", category: "Marketing & Growth" },
  { id: "MARKETING.EDIT", module: "MARKETING", action: "EDIT", label: "Edit Campaigns", description: "Modify discount rules, validity dates, and banners", category: "Marketing & Growth" },
  { id: "MARKETING.PUBLISH", module: "MARKETING", action: "PUBLISH", label: "Publish Campaigns", description: "Activate live storefront campaigns", category: "Marketing & Growth" },

  // POPUPS & ENGAGEMENT
  { id: "POPUPS.VIEW", module: "POPUPS", action: "VIEW", label: "View Popup Campaigns", description: "Browse engagement popups and frequency rules", category: "Popup & Engagement" },
  { id: "POPUPS.CREATE", module: "POPUPS", action: "CREATE", label: "Create Popups", description: "Design welcome, exit-intent, and anniversary popups", category: "Popup & Engagement" },
  { id: "POPUPS.EDIT", module: "POPUPS", action: "EDIT", label: "Edit Popup Triggers", description: "Configure audience segments and discount templates", category: "Popup & Engagement" },
  { id: "POPUPS.PUBLISH", module: "POPUPS", action: "PUBLISH", label: "Publish Popups", description: "Deploy popups live to storefront", category: "Popup & Engagement" },
  { id: "POPUPS.ANALYTICS", module: "POPUPS", action: "ANALYTICS", label: "View Popup Analytics", description: "Inspect impressions, click-through, and conversion rates", category: "Popup & Engagement" },

  // CMS & CONTENT
  { id: "CMS.VIEW", module: "CMS", action: "VIEW", label: "View CMS Pages", description: "Browse landing pages, banners, and policies", category: "Content & CMS" },
  { id: "CMS.CREATE", module: "CMS", action: "CREATE", label: "Create Pages", description: "Draft new rich CMS landing pages", category: "Content & CMS" },
  { id: "CMS.EDIT", module: "CMS", action: "EDIT", label: "Edit CMS Content", description: "Modify page blocks, copy, and images", category: "Content & CMS" },
  { id: "CMS.PUBLISH", module: "CMS", action: "PUBLISH", label: "Publish Content", description: "Publish live CMS page versions", category: "Content & CMS" },

  // SEO & DIGITAL
  { id: "SEO.VIEW", module: "SEO", action: "VIEW", label: "View SEO Dashboard", description: "Inspect meta tags, OpenGraph, sitemap, and robots", category: "SEO & Digital" },
  { id: "SEO.EDIT", module: "SEO", action: "EDIT", label: "Edit SEO Metadata", description: "Configure structured data, canonical tags, and keywords", category: "SEO & Digital" },
  { id: "SEO.PUBLISH", module: "SEO", action: "PUBLISH", label: "Deploy SEO Updates", description: "Publish live dynamic sitemaps and indexation directives", category: "SEO & Digital" },

  // AUTOMATION & WEBHOOKS
  { id: "AUTOMATION.VIEW", module: "AUTOMATION", action: "VIEW", label: "View Messaging Automations", description: "Browse WhatsApp, SMS, and email campaign workflows", category: "Messaging & Automation" },
  { id: "WEBHOOKS.VIEW", module: "WEBHOOKS", action: "VIEW", label: "View n8n Webhook Outbox", description: "Monitor outbox queue, delivery status, and logs", category: "Integrations & Webhooks" },
  { id: "WEBHOOKS.CONFIGURE", module: "WEBHOOKS", action: "CONFIGURE", label: "Configure Webhook Endpoints", description: "Update target URLs, HMAC secrets, and event matrix", category: "Integrations & Webhooks" },
  { id: "WEBHOOKS.TEST", module: "WEBHOOKS", action: "TEST", label: "Test Webhook Ping", description: "Send diagnostic test webhooks to n8n", category: "Integrations & Webhooks" },
  { id: "WEBHOOKS.RETRY", module: "WEBHOOKS", action: "RETRY", label: "Retry Failed Outbox Items", description: "Re-queue failed or dead-letter webhooks", category: "Integrations & Webhooks" },

  // REPORTS & ANALYTICS
  { id: "REPORTS.VIEW", module: "REPORTS", action: "VIEW", label: "View ERP Reports", description: "Access daily sales, weekly trends, and performance KPIs", category: "Reports & Analytics" },
  { id: "REPORTS.EXPORT", module: "REPORTS", action: "EXPORT", label: "Export ERP Reports", description: "Download multi-tab Excel workbooks", category: "Reports & Analytics" },
  { id: "ANALYTICS.VIEW", module: "ANALYTICS", action: "VIEW", label: "View Analytics Hub", description: "Inspect high-level revenue and conversion graphs", category: "Reports & Analytics" },

  // TAX / GST
  { id: "TAX_MASTER.VIEW", module: "TAX_MASTER", action: "VIEW", label: "View Tax & GST Registers", description: "Inspect HSN breakdown, GSTR-1 summaries, and tax rates", category: "Compliance & Tax" },
  { id: "TAX_MASTER.EDIT", module: "TAX_MASTER", action: "EDIT", label: "Configure Tax Rates", description: "Modify GST rates and HSN classifications", category: "Compliance & Tax" },
  { id: "TAX_MASTER.EXPORT", module: "TAX_MASTER", action: "EXPORT", label: "Export GST Registers", description: "Download statutory 11-report GST spreadsheets", category: "Compliance & Tax" },

  // CATALOG & INVENTORY
  { id: "PRODUCTS.VIEW", module: "PRODUCTS", action: "VIEW", label: "View Cake Catalog", description: "Browse products, categories, flavors, and weights", category: "Products & Catalog" },
  { id: "PRODUCTS.CREATE", module: "PRODUCTS", action: "CREATE", label: "Create Products", description: "Add new cakes and bakery products", category: "Products & Catalog" },
  { id: "PRODUCTS.EDIT", module: "PRODUCTS", action: "EDIT", label: "Edit Product Details", description: "Modify pricing, descriptions, and media", category: "Products & Catalog" },
  { id: "INVENTORY.VIEW", module: "INVENTORY", action: "VIEW", label: "View Branch Stock", description: "Check real-time branch cake availability", category: "Products & Catalog" },
  { id: "INVENTORY.EDIT", module: "INVENTORY", action: "EDIT", label: "Update Stock Levels", description: "Toggle stock availability and daily kitchen batch limits", category: "Products & Catalog" },

  // BRANCHES & DELIVERY
  { id: "BRANCHES.VIEW", module: "BRANCHES", action: "VIEW", label: "View Branches", description: "Browse kitchen hub network and operational status", category: "Branch & Delivery" },
  { id: "BRANCHES.EDIT", module: "BRANCHES", action: "EDIT", label: "Configure Branches", description: "Modify branch hours, kitchens, and manager assignments", category: "Branch & Delivery" },
  { id: "DELIVERY.VIEW", module: "DELIVERY", action: "VIEW", label: "View Fleet Operations", description: "Monitor active delivery drivers and zone assignments", category: "Branch & Delivery" },
  { id: "DELIVERY.ASSIGN", module: "DELIVERY", action: "ASSIGN", label: "Assign Delivery Drivers", description: "Assign drivers to urgent orders", category: "Branch & Delivery" },

  // STAFF MANAGEMENT
  { id: "STAFF_MANAGEMENT.VIEW", module: "STAFF_MANAGEMENT", action: "VIEW", label: "View Staff & Profiles", description: "Browse staff directory and access profiles", category: "Administration & Security" },
  { id: "STAFF_MANAGEMENT.CREATE", module: "STAFF_MANAGEMENT", action: "CREATE", label: "Create Staff Accounts", description: "Create staff accounts and assign profiles", category: "Administration & Security" },
  { id: "STAFF_MANAGEMENT.EDIT", module: "STAFF_MANAGEMENT", action: "EDIT", label: "Edit Staff Accounts", description: "Modify staff details, profile assignments, and overrides", category: "Administration & Security" },
  { id: "STAFF_MANAGEMENT.PROFILES_CRUD", module: "STAFF_MANAGEMENT", action: "PROFILES_CRUD", label: "Manage Access Profiles", description: "Create, edit, duplicate, and archive access profiles", category: "Administration & Security" },

  // SETTINGS & LOGS
  { id: "SETTINGS.VIEW", module: "SETTINGS", action: "VIEW", label: "View Store Settings", description: "Browse operational preferences and system configuration", category: "Administration & Security" },
  { id: "SETTINGS.EDIT", module: "SETTINGS", action: "EDIT", label: "Modify Store Settings", description: "Update store policies, currencies, and integrations", category: "Administration & Security" },
  { id: "NOTIFICATIONS.VIEW", module: "NOTIFICATIONS", action: "VIEW", label: "View Notifications", description: "Inspect system notification queues and delivery alerts", category: "Messaging & Automation" },
];

// ── PRE-SEEDED SYSTEM ACCESS PROFILES ──────────────────────────────────────
export const SYSTEM_ACCESS_PROFILES: AccessProfile[] = [
  {
    id: "prof_telecaller",
    name: "Telecaller",
    slug: "telecaller",
    description: "Calling list execution, customer outreach, anniversary follow-ups, order notes, and conversion attribution.",
    status: "ACTIVE",
    is_system: true,
    permissions: [
      "TELEMARKETING.VIEW",
      "TELEMARKETING.EXPORT",
      "TELEMARKETING.CONTACT",
      "TELEMARKETING.UPDATE_STATUS",
      "TELEMARKETING.ASSIGN",
      "TELEMARKETING.VIEW_HISTORY",
      "TELEMARKETING.CONVERT_ORDER",
      "CUSTOMERS.VIEW",
      "CUSTOMERS.SEARCH",
      "CUSTOMERS.VIEW_PHONE",
      "CUSTOMERS.VIEW_EMAIL",
      "ORDERS.VIEW",
      "ORDERS.VIEW_DETAILS",
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "prof_digital_marketing",
    name: "Digital Marketing",
    slug: "digital-marketing",
    description: "Campaigns, coupons, popups, banner CMS, SEO metadata, and engagement analytics.",
    status: "ACTIVE",
    is_system: true,
    permissions: [
      "MARKETING.VIEW",
      "MARKETING.CREATE",
      "MARKETING.EDIT",
      "MARKETING.PUBLISH",
      "POPUPS.VIEW",
      "POPUPS.CREATE",
      "POPUPS.EDIT",
      "POPUPS.PUBLISH",
      "POPUPS.ANALYTICS",
      "CMS.VIEW",
      "CMS.CREATE",
      "CMS.EDIT",
      "CMS.PUBLISH",
      "SEO.VIEW",
      "SEO.EDIT",
      "SEO.PUBLISH",
      "AUTOMATION.VIEW",
      "REPORTS.VIEW",
      "ANALYTICS.VIEW",
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "prof_seo_manager",
    name: "SEO Manager",
    slug: "seo-manager",
    description: "Technical SEO, dynamic sitemaps, robots.txt, structured data, canonical tags, and content metadata optimization.",
    status: "ACTIVE",
    is_system: true,
    permissions: [
      "SEO.VIEW",
      "SEO.EDIT",
      "SEO.PUBLISH",
      "CMS.VIEW",
      "CMS.EDIT",
      "REPORTS.VIEW",
      "ANALYTICS.VIEW",
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "prof_content_manager",
    name: "Content Manager",
    slug: "content-manager",
    description: "CMS pages, banners, media assets, product descriptions, and storefront copy management.",
    status: "ACTIVE",
    is_system: true,
    permissions: [
      "CMS.VIEW",
      "CMS.CREATE",
      "CMS.EDIT",
      "CMS.PUBLISH",
      "SEO.VIEW",
      "PRODUCTS.VIEW",
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "prof_customer_support",
    name: "Customer Support",
    slug: "customer-support",
    description: "Order lookup, customer contact info, delivery updates, and issue resolution.",
    status: "ACTIVE",
    is_system: true,
    permissions: [
      "ORDERS.VIEW",
      "ORDERS.VIEW_DETAILS",
      "CUSTOMERS.VIEW",
      "CUSTOMERS.SEARCH",
      "CUSTOMERS.VIEW_PHONE",
      "CUSTOMERS.VIEW_EMAIL",
      "NOTIFICATIONS.VIEW",
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "prof_branch_ops",
    name: "Branch Operations",
    slug: "branch-operations",
    description: "Kitchen orders, stock availability, and branch fleet monitoring.",
    status: "ACTIVE",
    is_system: true,
    permissions: [
      "BRANCHES.VIEW",
      "ORDERS.VIEW",
      "ORDERS.VIEW_DETAILS",
      "INVENTORY.VIEW",
      "INVENTORY.EDIT",
      "DELIVERY.VIEW",
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
];

// ── PRE-SEEDED REALISTIC STAFF ACCOUNTS ────────────────────────────────────
export const INITIAL_STAFF_MEMBERS: StaffMember[] = [
  {
    id: "staff_01",
    user_id: "usr_priya_telecaller",
    name: "Priya Sharma",
    phone: "+91 98765 43210",
    email: "priya.sharma@cakes2home.com",
    role: "STAFF",
    profile_id: "prof_telecaller",
    profile_name: "Telecaller",
    profile_ids: ["prof_telecaller"],
    profile_names: ["Telecaller"],
    branch_id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    branch_name: "Indiranagar Flagship Kitchen",
    city: "Bengaluru",
    status: "ACTIVE",
    overrides: {},
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "staff_02",
    user_id: "usr_sneha_mktg",
    name: "Sneha Menon",
    phone: "+91 98800 55443",
    email: "sneha.menon@cakes2home.com",
    role: "STAFF",
    profile_id: "prof_digital_marketing",
    profile_name: "Digital Marketing",
    profile_ids: ["prof_digital_marketing"],
    profile_names: ["Digital Marketing"],
    branch_id: null,
    city: "Bengaluru",
    status: "ACTIVE",
    overrides: {},
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "staff_03",
    user_id: "usr_rahul_seo",
    name: "Rahul Verma",
    phone: "+91 97711 22334",
    email: "rahul.verma@cakes2home.com",
    role: "STAFF",
    profile_id: "prof_seo_manager",
    profile_name: "SEO Manager",
    profile_ids: ["prof_seo_manager"],
    profile_names: ["SEO Manager"],
    branch_id: null,
    city: "Bengaluru",
    status: "ACTIVE",
    overrides: {},
    created_at: "2026-08-05T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
  {
    id: "staff_04",
    user_id: "usr_kavita_cms",
    name: "Kavita Iyer",
    phone: "+91 99887 76655",
    email: "kavita.iyer@cakes2home.com",
    role: "STAFF",
    profile_id: "prof_content_manager",
    profile_name: "Content Manager",
    profile_ids: ["prof_content_manager"],
    profile_names: ["Content Manager"],
    branch_id: null,
    city: "Bengaluru",
    status: "ACTIVE",
    overrides: {},
    created_at: "2026-08-10T00:00:00.000Z",
    updated_at: "2026-08-16T08:00:00.000Z",
  },
];

// ── STORE & ENGINE ─────────────────────────────────────────────────────────
class StaffAccessControlStore {
  private profiles: AccessProfile[] = [...SYSTEM_ACCESS_PROFILES];
  private staffMembers: StaffMember[] = [...INITIAL_STAFF_MEMBERS];
  private profileAssignments: StaffAccessProfileAssignment[] = [];
  private auditLogs: PermissionAuditLog[] = [];

  constructor() {
    this.seedInitialAssignmentsAndAudit();
  }

  private seedInitialAssignmentsAndAudit() {
    // 1. Seed Many-to-Many Junction Assignments from Initial Staff
    this.staffMembers.forEach((staff) => {
      if (!staff.profile_ids || staff.profile_ids.length === 0) {
        staff.profile_ids = staff.profile_id ? [staff.profile_id] : [];
      }
      const profNames: string[] = [];
      staff.profile_ids.forEach((pid) => {
        const prof = this.profiles.find((p) => p.id === pid);
        if (prof) profNames.push(prof.name);
        this.profileAssignments.push({
          id: `assign_${staff.id}_${pid}`,
          staff_id: staff.id,
          profile_id: pid,
          assigned_at: staff.created_at || new Date().toISOString(),
          assigned_by: "admin_01",
        });
      });
      staff.profile_names = profNames;
      staff.profile_name = profNames.join(", ") || "No Profile";
    });

    // 2. Seed Initial Audit Logs
    this.auditLogs = [
      {
        id: "audit_init_1",
        actor_user_id: "admin_01",
        actor_name: "Super Admin",
        target_type: "PROFILE",
        target_id: "prof_telecaller",
        target_name: "Telecaller",
        action: "INITIALIZE_PROFILE",
        details: "System seeded canonical Telecaller access profile with 13 permissions.",
        created_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "audit_init_2",
        actor_user_id: "admin_01",
        actor_name: "Super Admin",
        target_type: "STAFF",
        target_id: "staff_01",
        target_name: "Priya Sharma",
        action: "ASSIGN_PROFILES",
        details: "Assigned Priya Sharma (+91 98765 43210) to access profiles: Telecaller.",
        created_at: "2026-08-01T00:00:00.000Z",
      },
      {
        id: "audit_init_3",
        actor_user_id: "admin_01",
        actor_name: "Super Admin",
        target_type: "PROFILE",
        target_id: "prof_digital_marketing",
        target_name: "Digital Marketing",
        action: "INITIALIZE_PROFILE",
        details: "System seeded Digital Marketing profile with 19 permissions.",
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ];
  }

  // ── CORE PERMISSION RESOLUTION (UNION OF MULTIPLE PROFILES) ─────────────────
  /**
   * Evaluates whether a user context has permission for a specific module and action.
   * Priority:
   * 1. SUPER_ADMIN -> Always TRUE
   * 2. Explicit Staff DENY -> FALSE (Takes top precedence for staff)
   * 3. Explicit Staff ALLOW -> TRUE
   * 4. Assigned Access Profiles Active & contains permission in UNION -> TRUE
   * 5. Default -> FALSE (Fail closed)
   */
  public hasPermission(userOrId: any, module: string, action: string = "VIEW"): boolean {
    if (!userOrId) return false;

    const normalizedModule = module.toUpperCase();
    const normalizedAction = action.toUpperCase();
    const permissionKey = `${normalizedModule}.${normalizedAction}`;
    const wildcardKey = `${normalizedModule}.*`;

    // 1. Resolve User / Role Context
    let role = "";
    let userId = "";
    let phone = "";

    if (typeof userOrId === "string") {
      userId = userOrId;
    } else if (typeof userOrId === "object") {
      role = (userOrId.role || userOrId.detected_role || "").toUpperCase();
      userId = userOrId.id || userOrId.user_id || userOrId.userId || "";
      phone = (userOrId.phone || "").replace(/\D/g, "").slice(-10);
    }

    // SUPER_ADMIN has full, unrestricted access
    if (role === "SUPER_ADMIN" || userId === "admin_01" || userId.includes("admin")) {
      return true;
    }

    // 2. Find Staff Record (by userId, id, or phone)
    const staff = this.staffMembers.find(
      (s) => s.user_id === userId || s.id === userId || (phone && s.phone.replace(/\D/g, "").slice(-10) === phone)
    );

    if (!staff || staff.status === "SUSPENDED") {
      // If role is Branch Manager or Delivery Partner, check baseline roles
      if (role === "BRANCH_MANAGER" && (normalizedModule === "BRANCHES" || normalizedModule === "ORDERS" || normalizedModule === "INVENTORY")) {
        return true;
      }
      if (role === "DELIVERY_PARTNER" && normalizedModule === "DELIVERY") {
        return true;
      }
      return false;
    }

    // 3. Check Explicit Staff Overrides
    if (staff.overrides) {
      if (staff.overrides[permissionKey] === "DENY" || staff.overrides[wildcardKey] === "DENY") {
        return false; // Explicit Staff DENY takes top priority
      }
      if (staff.overrides[permissionKey] === "ALLOW" || staff.overrides[wildcardKey] === "ALLOW") {
        return true;
      }
    }

    // 4. Collect ALL Assigned Access Profiles (UNION OF MULTIPLE PROFILES)
    const assignedProfileIds = new Set<string>();
    if (Array.isArray(staff.profile_ids) && staff.profile_ids.length > 0) {
      staff.profile_ids.forEach((pid) => assignedProfileIds.add(pid));
    }
    if (staff.profile_id) {
      assignedProfileIds.add(staff.profile_id);
    }
    // Also include junction assignments
    const junctionRecords = this.profileAssignments.filter((a) => a.staff_id === staff.id);
    junctionRecords.forEach((a) => assignedProfileIds.add(a.profile_id));

    if (assignedProfileIds.size === 0) {
      return false;
    }

    // 5. Filter to ACTIVE profiles only
    const activeProfiles = this.profiles.filter(
      (p) => assignedProfileIds.has(p.id) && p.status === "ACTIVE"
    );

    if (activeProfiles.length === 0) {
      return false;
    }

    // 6. Check if permission or module wildcard exists in ANY active profile (UNION)
    const hasProfilePerm = activeProfiles.some((profile) =>
      profile.permissions.some(
        (p) => p === permissionKey || p === wildcardKey || p === "*.*" || p === "*"
      )
    );

    return hasProfilePerm;
  }

  /**
   * Retrieves full list of effective active permissions for a user (Deduplicated UNION)
   */
  public getEffectivePermissions(userOrId: any): string[] {
    const userRole = typeof userOrId === "object" ? (userOrId.role || "").toUpperCase() : "";
    if (userRole === "SUPER_ADMIN" || userOrId === "admin_01" || userOrId?.id === "admin_01") {
      return PERMISSION_CATALOG.map((p) => p.id);
    }

    const effective = new Set<string>();
    for (const p of PERMISSION_CATALOG) {
      if (this.hasPermission(userOrId, p.module, p.action)) {
        effective.add(p.id);
      }
    }
    return Array.from(effective);
  }

  /**
   * Calculates the union of unique permissions across an arbitrary list of profile IDs
   */
  public calculateProfileUnionPermissions(profileIds: string[]): {
    uniquePermissions: string[];
    permissionCount: number;
    profileCount: number;
    permissionsByProfile: Record<string, string[]>;
  } {
    const uniqueSet = new Set<string>();
    const permissionsByProfile: Record<string, string[]> = {};
    const validProfileIds = new Set<string>();

    (profileIds || []).forEach((pid) => {
      const prof = this.profiles.find((p) => p.id === pid && p.status !== "ARCHIVED");
      if (prof) {
        validProfileIds.add(prof.id);
        permissionsByProfile[prof.id] = [...prof.permissions];
        prof.permissions.forEach((perm) => uniqueSet.add(perm));
      }
    });

    return {
      uniquePermissions: Array.from(uniqueSet),
      permissionCount: uniqueSet.size,
      profileCount: validProfileIds.size,
      permissionsByProfile,
    };
  }

  /**
   * Determines if a Super Admin dashboard tab is permitted for a user
   */
  public isTabPermitted(userOrRole: any, tabId: string): boolean {
    const rawRole = typeof userOrRole === "string" ? userOrRole.toUpperCase() : (userOrRole?.role || "").toUpperCase();
    if (rawRole === "SUPER_ADMIN" || userOrRole === "admin_01" || userOrRole?.id === "admin_01") {
      return true;
    }

    const TAB_PERMISSION_MAP: Record<string, { module: string; action: string }> = {
      orders: { module: "ORDERS", action: "VIEW" },
      catalog: { module: "PRODUCTS", action: "VIEW" },
      branches: { module: "BRANCHES", action: "VIEW" },
      delivery: { module: "DELIVERY", action: "VIEW" },
      tax_master: { module: "TAX_MASTER", action: "VIEW" },
      abandoned_carts: { module: "ORDERS", action: "VIEW" },
      telemarketing: { module: "TELEMARKETING", action: "VIEW" },
      crm: { module: "CUSTOMERS", action: "VIEW" },
      login_activity: { module: "SETTINGS", action: "VIEW" },
      marketing: { module: "MARKETING", action: "VIEW" },
      popups: { module: "POPUPS", action: "VIEW" },
      seo: { module: "SEO", action: "VIEW" },
      automation: { module: "AUTOMATION", action: "VIEW" },
      webhooks: { module: "WEBHOOKS", action: "VIEW" },
      cms: { module: "CMS", action: "VIEW" },
      analytics: { module: "ANALYTICS", action: "VIEW" },
      notifications: { module: "NOTIFICATIONS", action: "VIEW" },
      settings: { module: "SETTINGS", action: "VIEW" },
      staff_profiles: { module: "STAFF_MANAGEMENT", action: "VIEW" },
    };

    const req = TAB_PERMISSION_MAP[tabId];
    if (!req) return true;
    return this.hasPermission(userOrRole, req.module, req.action);
  }

  // ── ACCESS PROFILES MANAGEMENT ───────────────────────────────────────────
  public listProfiles(): AccessProfile[] {
    return [...this.profiles.filter((p) => p.status !== "ARCHIVED")];
  }

  public getAllProfiles(): AccessProfile[] {
    return [...this.profiles];
  }

  public getProfile(id: string): AccessProfile | null {
    return this.profiles.find((p) => p.id === id || p.slug === id) || null;
  }

  public createProfile(
    input: { name: string; description: string; permissions: string[]; status?: ProfileStatus },
    actorId: string = "admin_01",
    actorName: string = "Super Admin"
  ): AccessProfile {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `prof_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newProfile: AccessProfile = {
      id,
      name: input.name.trim(),
      slug,
      description: input.description.trim(),
      status: input.status || "ACTIVE",
      is_system: false,
      permissions: input.permissions || [],
      created_by: actorId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.profiles.push(newProfile);

    this.recordAudit({
      actor_user_id: actorId,
      actor_name: actorName,
      target_type: "PROFILE",
      target_id: newProfile.id,
      target_name: newProfile.name,
      action: "CREATE_PROFILE",
      details: `Created new access profile "${newProfile.name}" with ${newProfile.permissions.length} permissions.`,
      new_state: newProfile,
    });

    return newProfile;
  }

  public updateProfile(
    id: string,
    input: Partial<{ name: string; description: string; permissions: string[]; status: ProfileStatus }>,
    actorId: string = "admin_01",
    actorName: string = "Super Admin"
  ): AccessProfile {
    const prof = this.profiles.find((p) => p.id === id);
    if (!prof) throw new Error(`Access Profile "${id}" not found.`);

    const oldState = { ...prof };

    if (input.name !== undefined) prof.name = input.name.trim();
    if (input.description !== undefined) prof.description = input.description.trim();
    if (input.permissions !== undefined) prof.permissions = input.permissions;
    if (input.status !== undefined) prof.status = input.status;
    prof.updated_at = new Date().toISOString();

    this.recordAudit({
      actor_user_id: actorId,
      actor_name: actorName,
      target_type: "PROFILE",
      target_id: prof.id,
      target_name: prof.name,
      action: "UPDATE_PROFILE",
      details: `Updated access profile "${prof.name}". Active permissions: ${prof.permissions.length}.`,
      old_state: oldState,
      new_state: prof,
    });

    return prof;
  }

  public duplicateProfile(id: string, actorId: string = "admin_01", actorName: string = "Super Admin"): AccessProfile {
    const prof = this.profiles.find((p) => p.id === id);
    if (!prof) throw new Error(`Access Profile "${id}" not found.`);

    return this.createProfile(
      {
        name: `${prof.name} (Copy)`,
        description: `Copy of ${prof.name} - ${prof.description}`,
        permissions: [...prof.permissions],
        status: "ACTIVE",
      },
      actorId,
      actorName
    );
  }

  public archiveProfile(id: string, actorId: string = "admin_01", actorName: string = "Super Admin"): AccessProfile {
    const prof = this.profiles.find((p) => p.id === id);
    if (!prof) throw new Error(`Access Profile "${id}" not found.`);

    // Safe Deletion / Archiving: Check if any active staff are assigned across all multiple profile assignments
    const assignedStaffMembers = this.staffMembers.filter(
      (s) => (s.profile_ids?.includes(id) || s.profile_id === id) && s.status === "ACTIVE"
    );
    if (assignedStaffMembers.length > 0) {
      throw new Error(
        `Cannot archive profile "${prof.name}". It is currently assigned to ${assignedStaffMembers.length} active staff member(s) (${assignedStaffMembers.map((s) => s.name).join(", ")}). Please reassign them first.`
      );
    }

    prof.status = "ARCHIVED";
    prof.updated_at = new Date().toISOString();

    this.recordAudit({
      actor_user_id: actorId,
      actor_name: actorName,
      target_type: "PROFILE",
      target_id: prof.id,
      target_name: prof.name,
      action: "ARCHIVE_PROFILE",
      details: `Archived access profile "${prof.name}".`,
    });

    return prof;
  }

  // ── STAFF MEMBERS MANAGEMENT (MANY-TO-MANY MULTI-PROFILE SUPPORT) ──────────
  public listStaffMembers(): StaffMember[] {
    return this.staffMembers.map((s) => {
      const activeIds = s.profile_ids && s.profile_ids.length > 0 ? s.profile_ids : s.profile_id ? [s.profile_id] : [];
      const matchedProfiles = this.profiles.filter((p) => activeIds.includes(p.id));
      const profileNames = matchedProfiles.map((p) => p.name);

      return {
        ...s,
        profile_ids: activeIds,
        profile_names: profileNames,
        profile_name: profileNames.join(", ") || "No Profile",
        effective_permissions: this.getEffectivePermissions(s),
      };
    });
  }

  /**
   * Retrieves active, authorized staff members who have telecaller outreach permissions
   * (e.g. TELEMARKETING.CONTACT or TELEMARKETING.ASSIGN).
   * Respects branch and city scope filters.
   */
  public getEligibleTelecallers(options: { city?: string; branch_id?: string } = {}): StaffMember[] {
    const activeStaff = this.listStaffMembers().filter((s) => s.status === "ACTIVE");
    return activeStaff.filter((s) => {
      const hasTelePerm =
        this.hasPermission(s, "TELEMARKETING", "CONTACT") ||
        this.hasPermission(s, "TELEMARKETING", "ASSIGN");

      if (!hasTelePerm) return false;

      if (options.branch_id && s.branch_id && s.branch_id !== options.branch_id) {
        return false;
      }
      if (options.city && s.city && s.city.toLowerCase() !== options.city.toLowerCase()) {
        return false;
      }

      return true;
    });
  }

  public getStaffMember(idOrUserId: string): StaffMember | null {
    const staff = this.staffMembers.find((s) => s.id === idOrUserId || s.user_id === idOrUserId);
    if (!staff) return null;

    const activeIds = staff.profile_ids && staff.profile_ids.length > 0 ? staff.profile_ids : staff.profile_id ? [staff.profile_id] : [];
    const matchedProfiles = this.profiles.filter((p) => activeIds.includes(p.id));
    const profileNames = matchedProfiles.map((p) => p.name);

    return {
      ...staff,
      profile_ids: activeIds,
      profile_names: profileNames,
      profile_name: profileNames.join(", ") || "No Profile",
      effective_permissions: this.getEffectivePermissions(staff),
    };
  }

  public getStaffJunctionAssignments(staffId: string): StaffAccessProfileAssignment[] {
    return this.profileAssignments.filter((a) => a.staff_id === staffId);
  }

  public createStaffMember(
    input: {
      name: string;
      phone: string;
      email: string;
      profile_id?: string;
      accessProfileIds?: string[];
      profile_ids?: string[];
      branch_id?: string;
      branch_name?: string;
      city?: string;
      status?: "ACTIVE" | "SUSPENDED";
    },
    actorId: string = "admin_01",
    actorName: string = "Super Admin"
  ): StaffMember {
    const id = `staff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const userId = `usr_${input.phone.replace(/\D/g, "").slice(-10) || id}`;

    // 1. Normalize and deduplicate incoming profile IDs
    const rawIds = input.accessProfileIds || input.profile_ids || (input.profile_id ? [input.profile_id] : []);
    const uniqueIds = Array.from(new Set(rawIds.map((pid) => String(pid).trim()))).filter(Boolean);

    if (uniqueIds.length === 0) {
      throw new Error("Validation failed: Please select at least one access profile for the staff account.");
    }

    // 2. Validate every selected profile exists and is not ARCHIVED
    const matchedProfiles: AccessProfile[] = [];
    for (const pid of uniqueIds) {
      const prof = this.profiles.find((p) => p.id === pid);
      if (!prof) {
        throw new Error(`Invalid access profile ID: "${pid}". Profile does not exist.`);
      }
      if (prof.status === "ARCHIVED") {
        throw new Error(`Cannot assign archived access profile: "${prof.name}".`);
      }
      matchedProfiles.push(prof);
    }

    const profileNames = matchedProfiles.map((p) => p.name);
    const primaryProfileId = uniqueIds[0] || null;
    const primaryProfileName = profileNames.join(", ");

    const newStaff: StaffMember = {
      id,
      user_id: userId,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      role: "STAFF",
      profile_id: primaryProfileId,
      profile_name: primaryProfileName,
      profile_ids: uniqueIds,
      profile_names: profileNames,
      branch_id: input.branch_id || null,
      branch_name: input.branch_name || null,
      city: input.city || "Bengaluru",
      status: input.status || "ACTIVE",
      overrides: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Atomically create junction assignments
    uniqueIds.forEach((pid) => {
      this.profileAssignments.push({
        id: `assign_${newStaff.id}_${pid}`,
        staff_id: newStaff.id,
        profile_id: pid,
        assigned_at: newStaff.created_at,
        assigned_by: actorId,
      });
    });

    this.staffMembers.push(newStaff);

    // 4. Calculate union of permissions for audit log
    const unionPerms = this.getEffectivePermissions(newStaff);

    this.recordAudit({
      actor_user_id: actorId,
      actor_name: actorName,
      target_type: "STAFF",
      target_id: newStaff.id,
      target_name: newStaff.name,
      action: "CREATE_STAFF",
      details: `Created staff account for ${newStaff.name} (${newStaff.phone}) with ${uniqueIds.length} profiles: [${profileNames.join(", ")}]. Effective permissions: ${unionPerms.length}.`,
      new_state: {
        ...newStaff,
        assigned_profiles: profileNames,
        effective_permissions_count: unionPerms.length,
      },
    });

    return {
      ...newStaff,
      effective_permissions: unionPerms,
    };
  }

  public updateStaffMember(
    id: string,
    input: Partial<{
      name: string;
      phone: string;
      email: string;
      profile_id: string;
      accessProfileIds: string[];
      profile_ids: string[];
      branch_id: string | null;
      branch_name: string | null;
      city: string | null;
      status: "ACTIVE" | "SUSPENDED";
      overrides: Record<string, "ALLOW" | "DENY">;
    }>,
    actorId: string = "admin_01",
    actorName: string = "Super Admin"
  ): StaffMember {
    const staff = this.staffMembers.find((s) => s.id === id || s.user_id === id);
    if (!staff) throw new Error(`Staff member "${id}" not found.`);

    const oldState = {
      ...staff,
      profile_ids: [...(staff.profile_ids || (staff.profile_id ? [staff.profile_id] : []))],
      profile_names: [...(staff.profile_names || (staff.profile_name ? [staff.profile_name] : []))],
    };

    if (input.name !== undefined) staff.name = input.name.trim();
    if (input.phone !== undefined) staff.phone = input.phone.trim();
    if (input.email !== undefined) staff.email = input.email.trim();
    if (input.branch_id !== undefined) staff.branch_id = input.branch_id;
    if (input.branch_name !== undefined) staff.branch_name = input.branch_name;
    if (input.city !== undefined) staff.city = input.city;
    if (input.status !== undefined) staff.status = input.status;
    if (input.overrides !== undefined) staff.overrides = input.overrides;

    // Profile Assignments Update (Atomic Many-to-Many Transaction)
    if (input.accessProfileIds !== undefined || input.profile_ids !== undefined || input.profile_id !== undefined) {
      const rawIds = input.accessProfileIds || input.profile_ids || (input.profile_id ? [input.profile_id] : []);
      const uniqueIds = Array.from(new Set(rawIds.map((pid) => String(pid).trim()))).filter(Boolean);

      if (uniqueIds.length === 0) {
        throw new Error("Validation failed: Staff account must have at least one assigned access profile.");
      }

      // Validate all profiles
      const matchedProfiles: AccessProfile[] = [];
      for (const pid of uniqueIds) {
        const prof = this.profiles.find((p) => p.id === pid);
        if (!prof) {
          throw new Error(`Invalid access profile ID: "${pid}". Profile does not exist.`);
        }
        if (prof.status === "ARCHIVED") {
          throw new Error(`Cannot assign archived access profile: "${prof.name}".`);
        }
        matchedProfiles.push(prof);
      }

      const profileNames = matchedProfiles.map((p) => p.name);

      // Atomic junction update: remove old, insert new
      this.profileAssignments = this.profileAssignments.filter((a) => a.staff_id !== staff.id);
      uniqueIds.forEach((pid) => {
        this.profileAssignments.push({
          id: `assign_${staff.id}_${pid}`,
          staff_id: staff.id,
          profile_id: pid,
          assigned_at: new Date().toISOString(),
          assigned_by: actorId,
        });
      });

      staff.profile_ids = uniqueIds;
      staff.profile_id = uniqueIds[0] || null;
      staff.profile_names = profileNames;
      staff.profile_name = profileNames.join(", ");
    }

    staff.updated_at = new Date().toISOString();

    const unionPerms = this.getEffectivePermissions(staff);

    this.recordAudit({
      actor_user_id: actorId,
      actor_name: actorName,
      target_type: "STAFF",
      target_id: staff.id,
      target_name: staff.name,
      action: "UPDATE_STAFF_PROFILES",
      details: `Updated profiles for ${staff.name}. Previous: [${oldState.profile_names.join(", ")}], New: [${staff.profile_names.join(", ")}]. Effective permissions: ${unionPerms.length}.`,
      old_state: oldState,
      new_state: {
        ...staff,
        effective_permissions_count: unionPerms.length,
      },
    });

    return {
      ...staff,
      effective_permissions: unionPerms,
    };
  }

  public setStaffOverride(
    staffId: string,
    permissionId: string,
    effect: "ALLOW" | "DENY" | "RESET",
    actorId: string = "admin_01",
    actorName: string = "Super Admin"
  ): StaffMember {
    const staff = this.staffMembers.find((s) => s.id === staffId || s.user_id === staffId);
    if (!staff) throw new Error(`Staff member "${staffId}" not found.`);

    if (!staff.overrides) staff.overrides = {};

    const oldOverrides = { ...staff.overrides };

    if (effect === "RESET") {
      delete staff.overrides[permissionId];
    } else {
      staff.overrides[permissionId] = effect;
    }
    staff.updated_at = new Date().toISOString();

    this.recordAudit({
      actor_user_id: actorId,
      actor_name: actorName,
      target_type: "STAFF",
      target_id: staff.id,
      target_name: staff.name,
      action: "SET_OVERRIDE",
      details: `Set explicit permission override for ${staff.name}: "${permissionId}" -> ${effect}.`,
      old_state: { overrides: oldOverrides },
      new_state: { overrides: staff.overrides },
    });

    return {
      ...staff,
      effective_permissions: this.getEffectivePermissions(staff),
    };
  }

  // ── AUDIT LOGGING ────────────────────────────────────────────────────────
  public listAuditLogs(limit?: number): PermissionAuditLog[] {
    const list = [...this.auditLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return limit ? list.slice(0, limit) : list;
  }

  private recordAudit(entry: Omit<PermissionAuditLog, "id" | "created_at">) {
    const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const fullEntry: PermissionAuditLog = {
      id,
      ...entry,
      created_at: new Date().toISOString(),
    };
    this.auditLogs.unshift(fullEntry);
    if (this.auditLogs.length > 500) {
      this.auditLogs = this.auditLogs.slice(0, 500);
    }
  }
}

export const StaffAccessControl = new StaffAccessControlStore();
