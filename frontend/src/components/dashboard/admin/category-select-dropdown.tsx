"use client";

import { useState, useRef, useEffect } from "react";
import { Input, Badge, Text } from "@medusajs/ui";
import { Search, ChevronDown, Check, FolderTree } from "lucide-react";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parent_id?: string | null;
  status?: string;
}

interface CategorySelectDropdownProps {
  categories: CategoryItem[];
  value?: string; // Primary category ID or Name
  selectedSecondaryIds?: string[];
  onChangePrimary: (categoryId: string, categoryName: string) => void;
  onChangeSecondary?: (categoryIds: string[]) => void;
  isMulti?: boolean;
  placeholder?: string;
}

export function CategorySelectDropdown({
  categories,
  value,
  selectedSecondaryIds = [],
  onChangePrimary,
  onChangeSecondary,
  isMulti = false,
  placeholder = "Select Category...",
}: CategorySelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter active categories only
  const activeCategories = categories.filter((c) => c.status !== "archived" && c.status !== "draft");

  // Build breadcrumb label for category (e.g. "Cakes › Birthday Cakes › Kids Cakes")
  const getCategoryPath = (cat: CategoryItem): string => {
    if (!cat.parent_id) return cat.name;
    const parent = categories.find((c) => c.id === cat.parent_id || c.name === cat.parent_id);
    if (!parent) return cat.name;
    return `${getCategoryPath(parent)} › ${cat.name}`;
  };

  const filteredCategories = activeCategories.filter((cat) => {
    const path = getCategoryPath(cat).toLowerCase();
    return path.includes(search.toLowerCase());
  });

  // Sort alphabetically
  filteredCategories.sort((a, b) => getCategoryPath(a).localeCompare(getCategoryPath(b)));

  const selectedCategory = categories.find((c) => c.id === value || c.name === value);
  const displayLabel = selectedCategory ? getCategoryPath(selectedCategory) : value || placeholder;

  const handleSelectPrimary = (cat: CategoryItem) => {
    onChangePrimary(cat.id, cat.name);
    setIsOpen(false);
  };

  const handleToggleSecondary = (catId: string) => {
    if (!onChangeSecondary) return;
    if (selectedSecondaryIds.includes(catId)) {
      onChangeSecondary(selectedSecondaryIds.filter((id) => id !== catId));
    } else {
      onChangeSecondary([...selectedSecondaryIds, catId]);
    }
  };

  return (
    <div ref={dropdownRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field flex items-center justify-between text-sm text-left hover:border-ui-border-interactive transition-colors"
      >
        <span className="truncate flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-purple-600 shrink-0" />
          <span className={selectedCategory ? "font-medium text-ui-fg-base" : "text-ui-fg-subtle"}>
            {displayLabel}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-ui-fg-subtle shrink-0" />
      </button>

      {/* Secondary Category Badges (if multi-mode enabled) */}
      {isMulti && selectedSecondaryIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedSecondaryIds.map((id) => {
            const cat = categories.find((c) => c.id === id || c.name === id);
            if (!cat) return null;
            return (
              <Badge key={id} color="purple" className="flex items-center gap-1 text-xs">
                {cat.name}
                <button
                  type="button"
                  onClick={() => handleToggleSecondary(id)}
                  className="hover:text-rose-400 font-bold ml-1"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto bg-ui-bg-base border border-ui-border-base rounded-md shadow-xl p-2 space-y-2">
          {/* Search Bar inside Dropdown */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-ui-fg-subtle" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
              autoFocus
            />
          </div>

          {/* Category List Options */}
          <div className="divide-y divide-ui-border-base/50">
            {filteredCategories.length === 0 ? (
              <Text className="text-xs text-ui-fg-subtle p-3 text-center">No categories found matching "{search}"</Text>
            ) : (
              filteredCategories.map((cat) => {
                const isPrimarySelected = value === cat.id || value === cat.name;
                const isSecSelected = selectedSecondaryIds.includes(cat.id);
                const fullPath = getCategoryPath(cat);
                const parts = fullPath.split(" › ");
                const leafName = parts[parts.length - 1];
                const parentPath = parts.slice(0, -1).join(" › ");

                return (
                  <div
                    key={cat.id}
                    onClick={() => (isMulti ? handleToggleSecondary(cat.id) : handleSelectPrimary(cat))}
                    className={`py-2 px-3 rounded-md cursor-pointer flex items-center justify-between text-xs transition-colors hover:bg-purple-50 dark:hover:bg-purple-950/40 ${
                      isPrimarySelected ? "bg-purple-100 dark:bg-purple-900/40 font-semibold" : ""
                    }`}
                  >
                    <div>
                      {parentPath && <div className="text-[10px] text-ui-fg-subtle">{parentPath} ›</div>}
                      <div className="text-ui-fg-base font-medium">{leafName}</div>
                    </div>

                    {(isPrimarySelected || isSecSelected) && (
                      <Check className="w-4 h-4 text-purple-600 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
