import { useState, useEffect } from "react";

export const useBranches = () => {
  const [data, setData] = useState<{ branches: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/admin/branches");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching branches", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, refetch };
};

export const useCities = () => {
  const [data, setData] = useState<{ cities: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/admin/cities");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching cities", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, refetch };
};

export const useRegions = () => {
  const [data, setData] = useState<{ regions: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/admin/regions");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching regions", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, refetch };
};

export const useBranchStaff = (branchId: string | null) => {
  const [data, setData] = useState<{ staff: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const response = await fetch(`/admin/branches/${branchId}/staff`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching branch staff", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [branchId]);

  return { data, loading, refetch };
};

export const useBranchInventory = (branchId: string | null) => {
  const [data, setData] = useState<{ inventories: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const response = await fetch(`/admin/branches/${branchId}/inventory`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching branch inventory", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [branchId]);

  return { data, loading, refetch };
};

export const useBranchPricing = (branchId: string | null) => {
  const [data, setData] = useState<{ pricing: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const response = await fetch(`/admin/branches/${branchId}/pricing`);
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching branch pricing", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, [branchId]);

  return { data, loading, refetch };
};

export const useTransfers = () => {
  const [data, setData] = useState<{ transfers: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = async () => {
    setLoading(true);
    try {
      const response = await fetch("/admin/inventory-transfers");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Error fetching transfers", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { data, loading, refetch };
};
