import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@/lib/router-compat";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { useDataState } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { useMasterSheetsSync } from "@/hooks/useMasterSheetsSync";
import {
  LayoutDashboard,
  Building2,
  Users,
  Search,
  FileSpreadsheet,
  Settings,
  Layers,
  Activity,
  CalendarCheck,
  CreditCard,
  RefreshCw,
  Database,
} from "lucide-react";
import { fmtCur } from "@/lib/formatters";

export function GlobalCommandBar() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { records } = useDataState();
  const { isExecutive } = useAuth();
  const { forceRefreshMaster } = useMasterSheetsSync();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !isInput)) {
        e.preventDefault();
        setOpen((openState) => !openState);
      }
    };
    const openEvent = () => setOpen(true);

    document.addEventListener("keydown", down);
    window.addEventListener("mahavtaar:open-command-bar", openEvent);
    return () => {
      document.removeEventListener("keydown", down);
      window.removeEventListener("mahavtaar:open-command-bar", openEvent);
    };
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    callback();
  };

  const matchedRecords = useMemo(() => {
    if (!search || search.trim().length < 2) return [];
    const query = search.toLowerCase().trim();

    const results = [];
    for (const r of records || []) {
      const name = String(
        r.customer_name || r.CUSTOMERNAME || r["Customer Name"] || r.CUSTOMER_NAME || "",
      ).toLowerCase();
      const id = String(
        r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || "",
      ).toLowerCase();
      const city = String(r.city || r.City || "").toLowerCase();
      const exec = String(r.executive_name || "").toLowerCase();

      if (id.includes(query) || name.includes(query) || city.includes(query) || exec.includes(query)) {
        results.push(r);
        if (results.length >= 10) break;
      }
    }
    return results;
  }, [search, records]);

  const cities = useMemo(() => {
    const s = new Set<string>();
    (records || []).forEach((r) => {
      const c = r.city || r.City;
      if (c) s.add(String(c).trim().toUpperCase());
    });
    return Array.from(s).sort();
  }, [records]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search agreements, customers, pages, or cities… (Esc to close)"
        value={search}
        onValueChange={setSearch}
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No matching results found.</CommandEmpty>

        {matchedRecords.length > 0 && (
          <CommandGroup heading="Agreements & Customers">
            {matchedRecords.map((r, i) => {
              const id = String(
                r.agreementid || r.agreement_no || r.AGREEMENTNO || r.AGREEMENTID || "-",
              );
              const name = String(
                r.customer_name || r.CUSTOMERNAME || r["Customer Name"] || r.CUSTOMER_NAME || "-",
              );
              const city = String(r.city || r.City || "-");
              const pos = Number(r.principal_outstanding || 0);
              const bkt = r.bom_bkt;

              return (
                <CommandItem
                  key={id + "-" + i}
                  value={`agreement ${id} ${name} ${city}`}
                  onSelect={() => handleSelect(() => navigate(`/customer/${encodeURIComponent(id)}`))}
                  className="flex items-center justify-between py-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-foreground text-xs truncate">{name}</span>
                      <span className="text-[11px] text-muted-foreground truncate font-mono">
                        {id} · {city} {bkt ? `· Bkt ${String(bkt)}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 ml-2">
                    <span className="text-xs font-semibold tabular-nums text-foreground">
                      {fmtCur(pos)}
                    </span>
                    <span className="text-[11px] font-medium text-primary">Open →</span>
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandGroup heading="Quick Actions">
          <CommandItem
            value="force refresh master allocation google sheets sync now"
            onSelect={() =>
              handleSelect(() => {
                void forceRefreshMaster();
              })
            }
          >
            <RefreshCw className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Force Refresh Master Allocation (Google Sheets)</span>
            <CommandShortcut>Sync</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="spreadsheet management settings google sheets drive"
            onSelect={() => handleSelect(() => navigate("/settings?tab=spreadsheets"))}
          >
            <Database className="mr-2 h-4 w-4 text-primary" />
            <span>Open Spreadsheet Management</span>
          </CommandItem>

          <CommandItem
            value="user management team roles settings"
            onSelect={() => handleSelect(() => navigate("/settings?tab=users"))}
          >
            <Users className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Manage Team Members &amp; Access</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Navigation">
          <CommandItem
            value="dashboard global analytics overview strategy"
            onSelect={() =>
              handleSelect(() => navigate(isExecutive() ? "/exec-dashboard" : "/dashboard"))
            }
          >
            <LayoutDashboard className="mr-2 h-4 w-4 text-primary" />
            <span>{isExecutive() ? "Executive Strategy" : "Portfolio Dashboard"}</span>
            <CommandShortcut>G D</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="city pivot matrix geographical reports ledger"
            onSelect={() => handleSelect(() => navigate("/city-pivot"))}
          >
            <Building2 className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>City Ledger &amp; Pivot</span>
            <CommandShortcut>G C</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="team pivot executive performance rankings ledger"
            onSelect={() => handleSelect(() => navigate("/team-pivot"))}
          >
            <Users className="mr-2 h-4 w-4 text-[#81258c] dark:text-purple-400" />
            <span>Team Ledger &amp; Pivot</span>
            <CommandShortcut>G T</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="data explorer records search filter grid cases"
            onSelect={() => handleSelect(() => navigate("/explorer"))}
          >
            <Search className="mr-2 h-4 w-4 text-primary" />
            <span>Data Explorer &amp; Cases</span>
            <CommandShortcut>G E</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="data entry feedback update payment ingestion"
            onSelect={() => handleSelect(() => navigate("/data-entry"))}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span>Data Ingestion &amp; Entry</span>
          </CommandItem>

          <CommandItem
            value="pos band explorer slabs analysis"
            onSelect={() => handleSelect(() => navigate("/band-explorer"))}
          >
            <Layers className="mr-2 h-4 w-4 text-[#81258c] dark:text-purple-400" />
            <span>POS Band Analysis</span>
          </CommandItem>

          <CommandItem
            value="live field monitoring real time updates"
            onSelect={() => handleSelect(() => navigate("/live-monitoring"))}
          >
            <Activity className="mr-2 h-4 w-4 text-rose-600 dark:text-rose-400" />
            <span>Live Field Tracking</span>
          </CommandItem>

          <CommandItem
            value="attendance punch daily tracking logs"
            onSelect={() => handleSelect(() => navigate("/attendance"))}
          >
            <CalendarCheck className="mr-2 h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>Attendance &amp; Punch Logs</span>
          </CommandItem>

          <CommandItem
            value="settings users targets configuration spreadsheets"
            onSelect={() => handleSelect(() => navigate("/settings"))}
          >
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>System Settings</span>
          </CommandItem>
        </CommandGroup>

        {cities.length > 0 && (
          <CommandGroup heading="Filter By City">
            {cities.slice(0, 8).map((city) => (
              <CommandItem
                key={city}
                value={`city filter ${city}`}
                onSelect={() =>
                  handleSelect(() => navigate(`/explorer?city=${encodeURIComponent(city)}`))
                }
              >
                <Building2 className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>Explore City: {city}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
