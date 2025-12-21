// @ts-nocheck
// ------------------------------
// Tenant selection state
// ------------------------------
const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

// ------------------------------
// When user clicks a tenant
// ------------------------------
const handleSelectTenant = (id: string) => {
  setSelectedTenantId(id);
};

// ------------------------------
// Find the currently selected tenant object
// ------------------------------
const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;
