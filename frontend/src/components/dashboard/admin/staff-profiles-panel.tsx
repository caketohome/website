"use client";

import { useEffect, useState, useMemo } from "react";
import { Container, Heading, Text, Button, Input, Badge, StatusBadge } from "@medusajs/ui";
import {
  Shield, Users, Key, History, Plus, Edit2, Copy, Archive, Check, X,
  AlertCircle, CheckCircle2, Search, Filter, Lock, Unlock, Sparkles,
  Phone, Mail, Building, MapPin, ChevronRight, UserCheck, ShieldAlert
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import {
  AccessProfile,
  StaffMember,
  StaffRole,
  PermissionAuditLog,
  PermissionDefinition,
  PERMISSION_CATALOG,
  StaffAccessControl
} from "@frontend/lib/staff-access-control";
import { MultiAccessProfileSelect } from "./multi-access-profile-select";

export function StaffProfilesPanel() {
  const [activeSubTab, setActiveSubTab] = useState<"staff" | "profiles" | "matrix" | "audit">("staff");

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [profilesList, setProfilesList] = useState<AccessProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<PermissionAuditLog[]>([]);
  const [catalog, setCatalog] = useState<PermissionDefinition[]>(PERMISSION_CATALOG);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [profileFilter, setProfileFilter] = useState("all");

  // Edit / Create Profile Modal State
  const [selectedProfile, setSelectedProfile] = useState<AccessProfile | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileFormName, setProfileFormName] = useState("");
  const [profileFormDesc, setProfileFormDesc] = useState("");
  const [profileFormPerms, setProfileFormPerms] = useState<string[]>([]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Edit / Create Staff Modal State
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffFormName, setStaffFormName] = useState("");
  const [staffFormPhone, setStaffFormPhone] = useState("");
  const [staffFormEmail, setStaffFormEmail] = useState("");
  const [staffFormRole, setStaffFormRole] = useState<StaffRole>("STAFF");
  const [staffFormProfileIds, setStaffFormProfileIds] = useState<string[]>([]);
  const [staffFormBranch, setStaffFormBranch] = useState("Flagship Kitchen");
  const [staffFormCity, setStaffFormCity] = useState("Bengaluru");
  const [staffFormStatus, setStaffFormStatus] = useState<"ACTIVE" | "SUSPENDED">("ACTIVE");
  const [isSavingStaff, setIsSavingStaff] = useState(false);

  // Staff Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideStaff, setOverrideStaff] = useState<StaffMember | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, sRes, aRes]: any = await Promise.all([
        apiClient.getAdminStaffProfiles(),
        apiClient.getAdminStaffMembers(),
        apiClient.getAdminPermissionAuditLogs(),
      ]);

      const profs = pRes?.profiles || StaffAccessControl.listProfiles();
      const staff = sRes?.staff || StaffAccessControl.listStaffMembers();
      const logs = aRes?.logs || StaffAccessControl.listAuditLogs();

      setProfilesList(profs);
      setStaffList(staff);
      setAuditLogs(logs);

      if (!selectedProfile && profs.length > 0) {
        setSelectedProfile(profs[0]);
      }
    } catch (err: any) {
      console.error("Failed to load staff profiles:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered staff members
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.phone.includes(searchQuery) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.profile_names && s.profile_names.some((pn) => pn.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const assignedIds = s.profile_ids && s.profile_ids.length > 0 ? s.profile_ids : s.profile_id ? [s.profile_id] : [];
      const matchesProfile = profileFilter === "all" || assignedIds.includes(profileFilter);
      return matchesSearch && matchesProfile;
    });
  }, [staffList, searchQuery, profileFilter]);

  // Grouped permission catalog
  const groupedCatalog = useMemo(() => {
    const map = new Map<string, PermissionDefinition[]>();
    for (const p of catalog) {
      const cat = p.category || "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries());
  }, [catalog]);

  // ── Profile CRUD Actions ─────────────────────────────────────────────────
  const openCreateProfileModal = () => {
    setSelectedProfile(null);
    setProfileFormName("");
    setProfileFormDesc("");
    setProfileFormPerms([]);
    setProfileModalOpen(true);
  };

  const openEditProfileModal = (prof: AccessProfile) => {
    setSelectedProfile(prof);
    setProfileFormName(prof.name);
    setProfileFormDesc(prof.description);
    setProfileFormPerms([...prof.permissions]);
    setProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileFormName.trim()) {
      alert("Profile name is required");
      return;
    }
    setIsSavingProfile(true);
    try {
      if (selectedProfile) {
        await apiClient.updateAdminStaffProfile(selectedProfile.id, {
          name: profileFormName,
          description: profileFormDesc,
          permissions: profileFormPerms,
        });
        setFeedback({ type: "success", message: `Updated access profile "${profileFormName}" successfully!` });
      } else {
        await apiClient.createAdminStaffProfile({
          name: profileFormName,
          description: profileFormDesc,
          permissions: profileFormPerms,
        });
        setFeedback({ type: "success", message: `Created access profile "${profileFormName}" with ${profileFormPerms.length} permissions!` });
      }
      setProfileModalOpen(false);
      fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert("Failed to save profile: " + err?.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleDuplicateProfile = async (prof: AccessProfile) => {
    try {
      await apiClient.duplicateAdminStaffProfile(prof.id);
      setFeedback({ type: "success", message: `Duplicated profile "${prof.name}" successfully!` });
      fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert("Failed to duplicate profile: " + err?.message);
    }
  };

  const handleArchiveProfile = async (prof: AccessProfile) => {
    if (!confirm(`Are you sure you want to archive profile "${prof.name}"?`)) return;
    try {
      await apiClient.archiveAdminStaffProfile(prof.id);
      setFeedback({ type: "success", message: `Archived profile "${prof.name}".` });
      fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert("Cannot archive profile: " + err?.message);
    }
  };

  // ── Staff CRUD Actions ───────────────────────────────────────────────────
  const openCreateStaffModal = () => {
    setSelectedStaff(null);
    setStaffFormName("");
    setStaffFormPhone("");
    setStaffFormEmail("");
    setStaffFormRole("STAFF");
    setStaffFormProfileIds([profilesList[0]?.id || "prof_telecaller"]);
    setStaffFormBranch("Indiranagar Flagship Kitchen");
    setStaffFormCity("Bengaluru");
    setStaffFormStatus("ACTIVE");
    setStaffModalOpen(true);
  };

  const openEditStaffModal = (staff: StaffMember) => {
    setSelectedStaff(staff);
    setStaffFormName(staff.name);
    setStaffFormPhone(staff.phone);
    setStaffFormEmail(staff.email);
    setStaffFormRole(staff.role || "STAFF");
    const initialIds =
      staff.profile_ids && staff.profile_ids.length > 0
        ? [...staff.profile_ids]
        : staff.profile_id
        ? [staff.profile_id]
        : [profilesList[0]?.id || "prof_telecaller"];
    setStaffFormProfileIds(initialIds);
    setStaffFormBranch(staff.branch_name || "");
    setStaffFormCity(staff.city || "");
    setStaffFormStatus(staff.status);
    setStaffModalOpen(true);
  };

  const handleSaveStaff = async () => {
    if (!staffFormName.trim() || !staffFormPhone.trim()) {
      alert("Name and phone number are required.");
      return;
    }
    if (staffFormProfileIds.length === 0) {
      alert("Please select at least one access profile for this staff account.");
      return;
    }
    setIsSavingStaff(true);
    try {
      if (selectedStaff) {
        await apiClient.updateAdminStaffMember(selectedStaff.id, {
          name: staffFormName,
          phone: staffFormPhone,
          email: staffFormEmail,
          role: staffFormRole,
          accessProfileIds: staffFormProfileIds,
          profile_ids: staffFormProfileIds,
          profile_id: staffFormProfileIds[0],
          branch_name: staffFormBranch,
          city: staffFormCity,
          status: staffFormStatus,
        });
        setFeedback({
          type: "success",
          message: `Updated staff member ${staffFormName} successfully with ${staffFormProfileIds.length} profiles!`,
        });
      } else {
        await apiClient.createAdminStaffMember({
          name: staffFormName,
          phone: staffFormPhone,
          email: staffFormEmail,
          role: staffFormRole,
          accessProfileIds: staffFormProfileIds,
          profile_ids: staffFormProfileIds,
          profile_id: staffFormProfileIds[0],
          branch_name: staffFormBranch,
          city: staffFormCity,
          status: staffFormStatus,
        });
        setFeedback({
          type: "success",
          message: `Created staff account for ${staffFormName} (${staffFormRole}) with ${staffFormProfileIds.length} profiles!`,
        });
      }
      setStaffModalOpen(false);
      fetchData();
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert("Failed to save staff: " + err?.message);
    } finally {
      setIsSavingStaff(false);
    }
  };

  // ── Override Management ──────────────────────────────────────────────────
  const openOverrideModal = (staff: StaffMember) => {
    setOverrideStaff(staff);
    setOverrideModalOpen(true);
  };

  const handleToggleOverride = async (permissionId: string, currentEffect?: "ALLOW" | "DENY") => {
    if (!overrideStaff) return;
    let nextEffect: "ALLOW" | "DENY" | "RESET" = "DENY";
    if (!currentEffect) nextEffect = "DENY";
    else if (currentEffect === "DENY") nextEffect = "ALLOW";
    else nextEffect = "RESET";

    try {
      const res: any = await apiClient.setAdminStaffOverride(overrideStaff.id, permissionId, nextEffect);
      const updated = res?.staff || res;
      setOverrideStaff(updated);
      setStaffList((prev) => prev.map((s) => (s.id === overrideStaff.id ? updated : s)));
      setFeedback({
        type: "success",
        message: `Override updated for ${overrideStaff.name}: ${permissionId} -> ${nextEffect}`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert("Failed to set override: " + err?.message);
    }
  };

  // ── Permission Matrix Toggles ────────────────────────────────────────────
  const togglePermissionInForm = (permId: string) => {
    setProfileFormPerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const toggleAllInCategory = (categoryPerms: PermissionDefinition[]) => {
    const catIds = categoryPerms.map((p) => p.id);
    const allSelected = catIds.every((id) => profileFormPerms.includes(id));
    if (allSelected) {
      setProfileFormPerms((prev) => prev.filter((id) => !catIds.includes(id)));
    } else {
      setProfileFormPerms((prev) => Array.from(new Set([...prev, ...catIds])));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
              <Key className="w-5 h-5" />
            </span>
            <Heading level="h2" className="text-xl font-bold tracking-tight">
              Staff & Access Profiles Governance
            </Heading>
          </div>
          <Text className="text-sm text-slate-500 mt-1">
            Super Admin controlled role-based access control (RBAC), granular feature permissions, and staff-level overrides.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="small"
            onClick={openCreateStaffModal}
            className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 text-xs shadow-sm font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Add Staff Member
          </Button>
          <Button
            variant="secondary"
            size="small"
            onClick={openCreateProfileModal}
            className="flex items-center gap-1.5 text-xs font-medium"
          >
            <Shield className="w-3.5 h-3.5 text-purple-600" /> New Access Profile
          </Button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center gap-2 border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/60 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab("staff")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === "staff"
              ? "bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Staff Members ({staffList.length})
        </button>
        <button
          onClick={() => setActiveSubTab("profiles")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === "profiles"
              ? "bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Shield className="w-3.5 h-3.5" /> Access Profiles ({profilesList.length})
        </button>
        <button
          onClick={() => setActiveSubTab("matrix")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === "matrix"
              ? "bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Key className="w-3.5 h-3.5" /> Permission Matrix
        </button>
        <button
          onClick={() => setActiveSubTab("audit")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors ${
            activeSubTab === "audit"
              ? "bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <History className="w-3.5 h-3.5" /> Audit Trail ({auditLogs.length})
        </button>
      </div>

      {/* ── SUB-TAB 1: STAFF MEMBERS ────────────────────────────────────────── */}
      {activeSubTab === "staff" && (
        <div className="space-y-4">
          <Container className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, phone (+91 98765 43210), or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Filter Profile:</span>
              <select
                value={profileFilter}
                onChange={(e) => setProfileFilter(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <option value="all">All Access Profiles</option>
                {profilesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </Container>

          <Container className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                  <tr>
                    <th className="p-3.5">Staff Member</th>
                    <th className="p-3.5">Contact Details</th>
                    <th className="p-3.5">Assigned Profile</th>
                    <th className="p-3.5">Branch & Scope</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Overrides</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStaff.map((staff) => {
                    const overrideCount = Object.keys(staff.overrides || {}).length;
                    return (
                      <tr key={staff.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-3.5 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs">
                              {staff.name.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{staff.name}</span>
                                {staff.role === "BRANCH_MANAGER" && (
                                  <Badge color="orange" className="text-[9px] px-1 py-0 font-bold">Manager</Badge>
                                )}
                                {staff.role === "DELIVERY_PARTNER" && (
                                  <Badge color="blue" className="text-[9px] px-1 py-0 font-bold">Delivery</Badge>
                                )}
                                {staff.role === "SUPER_ADMIN" && (
                                  <Badge color="red" className="text-[9px] px-1 py-0 font-bold">Admin</Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {staff.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                              <Phone className="w-3 h-3 text-slate-400" /> {staff.phone}
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                              <Mail className="w-3 h-3 text-slate-400" /> {staff.email || "—"}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {staff.profile_names && staff.profile_names.length > 0 ? (
                              staff.profile_names.map((pName, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shadow-2xs"
                                >
                                  <Shield className="w-3 h-3 text-purple-500" /> {pName}
                                </span>
                              ))
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                <Shield className="w-3 h-3" /> {staff.profile_name || "Assigned Profile"}
                              </span>
                            )}
                            {staff.effective_permissions && staff.effective_permissions.length > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                {staff.effective_permissions.length} perms
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">
                          <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200">
                            {staff.branch_name || "All Kitchens"}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <MapPin className="w-2.5 h-2.5" /> {staff.city || "—"}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <StatusBadge color={staff.status === "ACTIVE" ? "green" : "red"}>
                            {staff.status}
                          </StatusBadge>
                        </td>
                        <td className="p-3.5">
                          {overrideCount > 0 ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {overrideCount} Active Override{overrideCount > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">Default</span>
                          )}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => openOverrideModal(staff)}
                              className="text-[11px] h-7 px-2"
                            >
                              <ShieldAlert className="w-3 h-3 text-amber-600" /> Overrides
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => openEditStaffModal(staff)}
                              className="text-[11px] h-7 px-2"
                            >
                              <Edit2 className="w-3 h-3" /> Edit
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Container>
        </div>
      )}

      {/* ── SUB-TAB 2: ACCESS PROFILES ──────────────────────────────────────── */}
      {activeSubTab === "profiles" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profilesList.map((prof) => {
            const assignedCount = staffList.filter((s) => {
              const ids = s.profile_ids && s.profile_ids.length > 0 ? s.profile_ids : s.profile_id ? [s.profile_id] : [];
              return ids.includes(prof.id);
            }).length;
            return (
              <Container
                key={prof.id}
                className="p-5 flex flex-col justify-between border border-slate-200 dark:border-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all rounded-2xl shadow-sm bg-white dark:bg-slate-900"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
                        <Shield className="w-4 h-4" />
                      </span>
                      <Heading level="h3" className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {prof.name}
                      </Heading>
                    </div>
                    {prof.is_system ? (
                      <Badge color="blue" size="small">
                        SYSTEM
                      </Badge>
                    ) : (
                      <Badge color="green" size="small">
                        CUSTOM
                      </Badge>
                    )}
                  </div>

                  <Text className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {prof.description || "No description provided."}
                  </Text>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{prof.permissions.length}</span> Permitted Features
                    </div>
                    <div>
                      <span className="font-semibold text-purple-600 dark:text-purple-400">{assignedCount}</span> Staff Member{assignedCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => handleDuplicateProfile(prof)}
                      className="text-[11px] h-7 px-2"
                    >
                      <Copy className="w-3 h-3 text-slate-500" /> Copy
                    </Button>
                    {!prof.is_system && (
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleArchiveProfile(prof)}
                        className="text-[11px] h-7 px-2 text-red-600 hover:bg-red-50"
                      >
                        <Archive className="w-3 h-3" />
                      </Button>
                    )}
                  </div>

                  <Button
                    size="small"
                    onClick={() => openEditProfileModal(prof)}
                    className="text-[11px] h-7 px-3 bg-purple-600 hover:bg-purple-700 text-white font-medium"
                  >
                    <Edit2 className="w-3 h-3" /> Edit Permissions
                  </Button>
                </div>
              </Container>
            );
          })}
        </div>
      )}

      {/* ── SUB-TAB 3: VISUAL PERMISSION MATRIX ─────────────────────────────── */}
      {activeSubTab === "matrix" && (
        <div className="space-y-4">
          <Container className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Select Profile to Inspect:</span>
              <select
                value={selectedProfile?.id || ""}
                onChange={(e) => {
                  const p = profilesList.find((prof) => prof.id === e.target.value);
                  if (p) setSelectedProfile(p);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-bold text-purple-700 dark:text-purple-300"
              >
                {profilesList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.permissions.length} perms)
                  </option>
                ))}
              </select>
            </div>

            {selectedProfile && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => openEditProfileModal(selectedProfile)}
                  className="text-xs"
                >
                  <Edit2 className="w-3 h-3" /> Edit in Matrix Editor
                </Button>
              </div>
            )}
          </Container>

          {selectedProfile && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedCatalog.map(([category, perms]) => {
                return (
                  <Container key={category} className="p-4 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-xs text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span>{category}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {perms.filter((p) => selectedProfile.permissions.includes(p.id)).length}/{perms.length}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {perms.map((p) => {
                        const isGranted = selectedProfile.permissions.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-lg text-xs flex items-start gap-2 border ${
                              isGranted
                                ? "bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200"
                                : "bg-slate-50 dark:bg-slate-900/60 border-slate-100 dark:border-slate-800 text-slate-400"
                            }`}
                          >
                            {isGranted ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
                            )}
                            <div>
                              <div className="font-semibold">{p.label}</div>
                              <div className="text-[10px] opacity-75 font-mono">{p.id}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Container>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 4: AUDIT TRAIL ─────────────────────────────────────────── */}
      {activeSubTab === "audit" && (
        <Container className="p-0 overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="p-3.5">Timestamp</th>
                  <th className="p-3.5">Actor</th>
                  <th className="p-3.5">Target</th>
                  <th className="p-3.5">Action</th>
                  <th className="p-3.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("en-IN")}
                    </td>
                    <td className="p-3.5 font-medium text-slate-900 dark:text-slate-100">
                      {log.actor_name}
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-purple-700 dark:text-purple-300">
                        {log.target_name}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1 font-mono">({log.target_type})</span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400 max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      )}

      {/* ── MODAL: EDIT / CREATE ACCESS PROFILE ────────────────────────────── */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                <Heading level="h3" className="text-lg font-bold">
                  {selectedProfile ? `Edit Profile: ${selectedProfile.name}` : "Create New Access Profile"}
                </Heading>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Profile Name *
                  </label>
                  <Input
                    placeholder="e.g. Telecaller, Digital Marketing, SEO Manager"
                    value={profileFormName}
                    onChange={(e) => setProfileFormName(e.target.value)}
                    size="small"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Description
                  </label>
                  <Input
                    placeholder="Brief summary of profile duties and permitted scope"
                    value={profileFormDesc}
                    onChange={(e) => setProfileFormDesc(e.target.value)}
                    size="small"
                  />
                </div>
              </div>

              {/* Permission Matrix Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Configured Permissions ({profileFormPerms.length} Selected)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setProfileFormPerms(catalog.map((p) => p.id))}
                      className="text-[11px] text-purple-600 font-semibold hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setProfileFormPerms([])}
                      className="text-[11px] text-slate-500 hover:underline"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupedCatalog.map(([category, perms]) => {
                    const allCatSelected = perms.every((p) => profileFormPerms.includes(p.id));
                    return (
                      <div
                        key={category}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2"
                      >
                        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {category}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleAllInCategory(perms)}
                            className="text-[10px] text-purple-600 hover:underline font-medium"
                          >
                            {allCatSelected ? "Deselect Group" : "Select Group"}
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {perms.map((p) => {
                            const checked = profileFormPerms.includes(p.id);
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2 p-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                                  checked
                                    ? "bg-purple-50 dark:bg-purple-950/60 text-purple-900 dark:text-purple-100 font-medium"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermissionInForm(p.id)}
                                  className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                                />
                                <div>
                                  <div>{p.label}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{p.id}</div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <Button variant="secondary" size="small" onClick={() => setProfileModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="small"
                onClick={handleSaveProfile}
                isLoading={isSavingProfile}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
              >
                Save Access Profile
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDIT / CREATE STAFF MEMBER ──────────────────────────────── */}
      {staffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <Heading level="h3" className="text-lg font-bold">
                  {selectedStaff ? `Edit Staff: ${selectedStaff.name}` : "Create Staff Account"}
                </Heading>
              </div>
              <button
                onClick={() => setStaffModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name *
                </label>
                <Input
                  placeholder="e.g. Priya Sharma"
                  value={staffFormName}
                  onChange={(e) => setStaffFormName(e.target.value)}
                  size="small"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Phone Number (OTP Authentication) *
                </label>
                <Input
                  placeholder="+91 98765 43210"
                  value={staffFormPhone}
                  onChange={(e) => setStaffFormPhone(e.target.value)}
                  size="small"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Address
                </label>
                <Input
                  placeholder="priya.sharma@cakes2home.com"
                  value={staffFormEmail}
                  onChange={(e) => setStaffFormEmail(e.target.value)}
                  size="small"
                />
              </div>

              <div>
                <MultiAccessProfileSelect
                  profiles={profilesList}
                  selectedProfileIds={staffFormProfileIds}
                  onChange={setStaffFormProfileIds}
                  catalog={catalog}
                  required={true}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Kitchen / Branch Scope
                  </label>
                  <Input
                    placeholder="Indiranagar Flagship Kitchen"
                    value={staffFormBranch}
                    onChange={(e) => setStaffFormBranch(e.target.value)}
                    size="small"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    City Scope
                  </label>
                  <Input
                    placeholder="Bengaluru"
                    value={staffFormCity}
                    onChange={(e) => setStaffFormCity(e.target.value)}
                    size="small"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Business Role *
                  </label>
                  <select
                    value={staffFormRole}
                    onChange={(e: any) => {
                      const newRole = e.target.value as StaffRole;
                      setStaffFormRole(newRole);
                      if (newRole === "BRANCH_MANAGER" && !staffFormProfileIds.includes("prof_branch_ops")) {
                        setStaffFormProfileIds((prev) => Array.from(new Set([...prev, "prof_branch_ops"])));
                      } else if (newRole === "DELIVERY_PARTNER" && !staffFormProfileIds.includes("prof_delivery_ops")) {
                        setStaffFormProfileIds((prev) => Array.from(new Set([...prev, "prof_delivery_ops"])));
                      }
                    }}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 font-medium"
                  >
                    <option value="STAFF">General Staff</option>
                    <option value="BRANCH_MANAGER">Store / Branch Manager</option>
                    <option value="DELIVERY_PARTNER">Delivery Partner / Driver</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Account Status
                  </label>
                  <select
                    value={staffFormStatus}
                    onChange={(e: any) => setStaffFormStatus(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-900">
              <Button variant="secondary" size="small" onClick={() => setStaffModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="small"
                onClick={handleSaveStaff}
                isLoading={isSavingStaff}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium"
              >
                Save Staff Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: MANAGE STAFF OVERRIDES ─────────────────────────────────── */}
      {overrideModalOpen && overrideStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <Heading level="h3" className="text-lg font-bold">
                    Explicit Permission Overrides: {overrideStaff.name}
                  </Heading>
                </div>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Profile: <span className="font-semibold text-purple-600">{overrideStaff.profile_name}</span>. An explicit DENY takes top priority over profile ALLOW.
                </Text>
              </div>
              <button
                onClick={() => setOverrideModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {catalog.map((p) => {
                  const currentOverride = overrideStaff.overrides?.[p.id];
                  return (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {p.label}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.id}</div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleOverride(p.id, currentOverride)}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors ${
                            currentOverride === "DENY"
                              ? "bg-red-600 text-white"
                              : currentOverride === "ALLOW"
                              ? "bg-emerald-600 text-white"
                              : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                          }`}
                        >
                          {currentOverride || "DEFAULT"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end bg-slate-50 dark:bg-slate-900">
              <Button size="small" onClick={() => setOverrideModalOpen(false)} className="bg-purple-600 text-white">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
