import { useState, useEffect, useCallback } from "react";

export interface SettingEntry {
    id: string;
    group: string;
    key: string;
    value: string | null;
    is_json: boolean;
    is_secret: boolean;
    description: string | null;
}

interface SettingsListResponse {
    settings: SettingEntry[];
}

interface SettingsGroupResponse {
    group: string;
    settings: Record<string, unknown>;
}

/**
 * Fetch all settings (admin).
 */
export const useSettings = (): {
    data: SettingsListResponse | null;
    loading: boolean;
    refetch: () => void;
} => {
    const [data, setData] = useState<SettingsListResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/admin/settings");
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching settings", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

/**
 * Fetch a single settings group (admin).
 */
export const useSettingGroup = (
    group: string | null
): {
    data: SettingsGroupResponse | null;
    loading: boolean;
} => {
    const [data, setData] = useState<SettingsGroupResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!group) {
            setData(null);
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/admin/settings/${group}`);
                const result = await response.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching setting group", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [group]);

    return { data, loading };
};

/**
 * Upsert a setting value (admin).
 */
export const saveSetting = async (payload: {
    group: string;
    key: string;
    value: unknown;
    is_json?: boolean;
    is_secret?: boolean;
    description?: string;
}): Promise<boolean> => {
    const response = await fetch("/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    return response.ok;
};
