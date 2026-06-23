import {
  Activity,
  Blocks,
  Columns3,
  Database,
  Eye,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Table2,
  TerminalSquare
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  executeSelectQuery,
  getDatabaseTableColumns,
  getDatabaseTableRows,
  getDatabaseTables,
  getHealth,
  getPrimaveraModules,
  testDatabaseConnection
} from './services/databaseApi.js';

const defaultQuery = 'SELECT TOP (@limit) * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = @tableType';
const defaultParameters = JSON.stringify({ limit: 20, tableType: 'BASE TABLE' }, null, 2);

const statusText = {
  idle: 'Idle',
  loading: 'Checking',
  ok: 'Online',
  error: 'Attention'
};

function StatusCard({ icon: Icon, label, value, tone = 'neutral', detail }) {
  return (
    <section className="status-card">
      <div className={`status-icon ${tone}`}>
        <Icon size={20} aria-hidden="true" />
      </div>
      <div>
        <p className="eyebrow">{label}</p>
        <h2>{value}</h2>
        {detail ? <p className="muted">{detail}</p> : null}
      </div>
    </section>
  );
}

function ModuleTile({ module }) {
  return (
    <article className="module-tile">
      <Blocks size={18} aria-hidden="true" />
      <div>
        <h3>{module.name}</h3>
        <span>{module.status}</span>
      </div>
    </article>
  );
}

function ResultsTable({ result }) {
  const rows = result?.rows ?? [];
  const columns = result?.columns?.length ? result.columns : Object.keys(rows[0] ?? {});

  if (!rows.length) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>No rows returned</span>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${columns.join('-')}`}>
              {columns.map((column) => (
                <td key={column}>{formatCellValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatRowCount(value) {
  if (value === null || value === undefined) return 'unknown';
  return Number(value).toLocaleString();
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function App() {
  const [health, setHealth] = useState({ status: 'idle', data: null, error: null });
  const [database, setDatabase] = useState({ status: 'idle', data: null, error: null });
  const [modules, setModules] = useState([]);
  const [tableSearch, setTableSearch] = useState('');
  const [tablesState, setTablesState] = useState({ loading: false, tables: [], error: null });
  const [selectedTable, setSelectedTable] = useState(null);
  const [previewLimit, setPreviewLimit] = useState(50);
  const [tablePreview, setTablePreview] = useState({
    loading: false,
    columns: [],
    result: null,
    error: null
  });
  const [query, setQuery] = useState(defaultQuery);
  const [parameters, setParameters] = useState(defaultParameters);
  const [maxRows, setMaxRows] = useState(100);
  const [queryState, setQueryState] = useState({ loading: false, result: null, error: null });

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const appName = import.meta.env.VITE_APP_NAME || 'Medimoc Primavera Dashboard';

  const databaseDetail = useMemo(() => {
    if (database.data?.databaseName) return database.data.databaseName;
    if (database.error) return database.error;
    return 'SQL Server';
  }, [database]);

  const refreshStatus = async () => {
    setHealth((current) => ({ ...current, status: 'loading', error: null }));
    setDatabase((current) => ({ ...current, status: 'loading', error: null }));

    const [healthResult, databaseResult] = await Promise.allSettled([
      getHealth(),
      testDatabaseConnection()
    ]);

    if (healthResult.status === 'fulfilled') {
      setHealth({ status: 'ok', data: healthResult.value.data, error: null });
    } else {
      setHealth({ status: 'error', data: null, error: healthResult.reason.message });
    }

    if (databaseResult.status === 'fulfilled') {
      setDatabase({ status: 'ok', data: databaseResult.value.data, error: null });
    } else {
      setDatabase({ status: 'error', data: null, error: databaseResult.reason.message });
    }
  };

  const loadModules = async () => {
    try {
      const response = await getPrimaveraModules();
      setModules(response.data);
    } catch {
      setModules([]);
    }
  };

  const selectDatabaseTable = async (table, limit = previewLimit) => {
    setSelectedTable(table);
    setTablePreview({ loading: true, columns: [], result: null, error: null });

    try {
      const request = {
        schemaName: table.schemaName,
        tableName: table.tableName
      };
      const [columnsResponse, rowsResponse] = await Promise.all([
        getDatabaseTableColumns(request),
        getDatabaseTableRows({ ...request, limit: Number(limit) })
      ]);

      setTablePreview({
        loading: false,
        columns: columnsResponse.data.columns,
        result: rowsResponse.data,
        error: null
      });
    } catch (error) {
      setTablePreview({
        loading: false,
        columns: [],
        result: null,
        error: error.message
      });
    }
  };

  const loadTables = async (search = tableSearch) => {
    setTablesState((current) => ({ ...current, loading: true, error: null }));

    try {
      const response = await getDatabaseTables({ search, limit: 200 });
      const tables = response.data.tables;

      setTablesState({ loading: false, tables, error: null });

      if (!selectedTable && tables.length > 0) {
        selectDatabaseTable(tables[0]);
      }
    } catch (error) {
      setTablesState({ loading: false, tables: [], error: error.message });
      setTablePreview((current) => ({ ...current, loading: false }));
    }
  };

  const submitTableSearch = (event) => {
    event.preventDefault();
    loadTables(tableSearch);
  };

  const refreshSelectedPreview = () => {
    if (selectedTable) {
      selectDatabaseTable(selectedTable, previewLimit);
    }
  };

  const runQuery = async (event) => {
    event.preventDefault();
    setQueryState({ loading: true, result: null, error: null });

    try {
      const parsedParameters = parameters.trim() ? JSON.parse(parameters) : {};
      const response = await executeSelectQuery({
        query,
        parameters: parsedParameters,
        maxRows: Number(maxRows)
      });

      setQueryState({ loading: false, result: response.data, error: null });
    } catch (error) {
      setQueryState({ loading: false, result: null, error: error.message });
    }
  };

  useEffect(() => {
    refreshStatus();
    loadModules();
    loadTables('');
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <div className="brand-mark">
            <Database size={24} aria-hidden="true" />
          </div>
          <div>
            <strong>Medimoc</strong>
            <span>Primavera SQL</span>
          </div>
        </div>

        <nav>
          <a className="active" href="#overview">
            <Activity size={18} aria-hidden="true" />
            Overview
          </a>
          <a href="#query">
            <TerminalSquare size={18} aria-hidden="true" />
            Query
          </a>
          <a href="#data">
            <Table2 size={18} aria-hidden="true" />
            Data
          </a>
          <a href="#modules">
            <Blocks size={18} aria-hidden="true" />
            Modules
          </a>
        </nav>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1>{appName}</h1>
          </div>
          <button className="icon-button" type="button" onClick={refreshStatus} aria-label="Refresh status">
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </header>

        <section id="overview" className="status-grid" aria-label="System status">
          <StatusCard
            icon={Server}
            label="API"
            value={statusText[health.status]}
            tone={health.status === 'ok' ? 'success' : health.status === 'error' ? 'danger' : 'neutral'}
            detail={health.data?.timestamp ?? apiBaseUrl}
          />
          <StatusCard
            icon={Database}
            label="Database"
            value={statusText[database.status]}
            tone={database.status === 'ok' ? 'success' : database.status === 'error' ? 'danger' : 'neutral'}
            detail={databaseDetail}
          />
          <StatusCard
            icon={ShieldCheck}
            label="Security"
            value="Parameterized"
            tone="success"
            detail="SELECT-only execution"
          />
        </section>

        <section id="query" className="workbench">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SQL Workbench</p>
              <h2>Safe SELECT Runner</h2>
            </div>
            {queryState.result ? (
              <span className="pill">{queryState.result.returnedRows} rows</span>
            ) : null}
          </div>

          <form className="query-form" onSubmit={runQuery}>
            <label htmlFor="query">Query</label>
            <textarea
              id="query"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              rows={6}
              spellCheck="false"
            />

            <div className="form-grid">
              <div>
                <label htmlFor="parameters">Parameters JSON</label>
                <textarea
                  id="parameters"
                  value={parameters}
                  onChange={(event) => setParameters(event.target.value)}
                  rows={6}
                  spellCheck="false"
                />
              </div>
              <div>
                <label htmlFor="maxRows">Max rows</label>
                <input
                  id="maxRows"
                  min="1"
                  max="1000"
                  type="number"
                  value={maxRows}
                  onChange={(event) => setMaxRows(event.target.value)}
                />
                <button className="primary-button" type="submit" disabled={queryState.loading}>
                  <Play size={18} aria-hidden="true" />
                  {queryState.loading ? 'Running' : 'Run query'}
                </button>
              </div>
            </div>
          </form>

          {queryState.error ? <div className="error-banner">{queryState.error}</div> : null}
          {queryState.result ? <ResultsTable result={queryState.result} /> : null}
        </section>

        <section id="data" className="data-browser">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Database Browser</p>
              <h2>Live Primavera Tables</h2>
            </div>
            <form className="table-search" onSubmit={submitTableSearch}>
              <input
                aria-label="Search tables"
                placeholder="Search tables"
                value={tableSearch}
                onChange={(event) => setTableSearch(event.target.value)}
              />
              <button className="secondary-button" type="submit" disabled={tablesState.loading}>
                <Search size={17} aria-hidden="true" />
                Search
              </button>
            </form>
          </div>

          {tablesState.error ? <div className="error-banner">{tablesState.error}</div> : null}

          <div className="browser-layout">
            <aside className="table-list-panel" aria-label="Database tables">
              <div className="panel-heading">
                <Table2 size={18} aria-hidden="true" />
                <span>{tablesState.loading ? 'Loading tables' : `${tablesState.tables.length} tables`}</span>
              </div>

              <div className="table-list">
                {tablesState.tables.map((table) => {
                  const key = `${table.schemaName}.${table.tableName}`;
                  const isSelected =
                    selectedTable?.schemaName === table.schemaName &&
                    selectedTable?.tableName === table.tableName;

                  return (
                    <button
                      className={isSelected ? 'selected' : ''}
                      key={key}
                      type="button"
                      onClick={() => selectDatabaseTable(table)}
                    >
                      <strong>{key}</strong>
                      <span>{formatRowCount(table.rowCount)} rows</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="table-preview-panel">
              {selectedTable ? (
                <>
                  <div className="preview-toolbar">
                    <div>
                      <p className="eyebrow">Selected Table</p>
                      <h3>
                        {selectedTable.schemaName}.{selectedTable.tableName}
                      </h3>
                    </div>
                    <div className="preview-controls">
                      <label htmlFor="previewLimit">Rows</label>
                      <input
                        id="previewLimit"
                        min="1"
                        max="1000"
                        type="number"
                        value={previewLimit}
                        onChange={(event) => setPreviewLimit(event.target.value)}
                      />
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={refreshSelectedPreview}
                        disabled={tablePreview.loading}
                      >
                        <Eye size={17} aria-hidden="true" />
                        Preview
                      </button>
                    </div>
                  </div>

                  <div className="columns-strip" aria-label="Table columns">
                    <Columns3 size={17} aria-hidden="true" />
                    {tablePreview.columns.length ? (
                      tablePreview.columns.map((column) => (
                        <span key={column.columnName}>
                          {column.columnName}
                          <small>{column.dataType}</small>
                        </span>
                      ))
                    ) : (
                      <span>No columns loaded</span>
                    )}
                  </div>

                  {tablePreview.error ? <div className="error-banner">{tablePreview.error}</div> : null}
                  {tablePreview.loading ? (
                    <div className="empty-state">
                      <RefreshCw size={22} aria-hidden="true" />
                      <span>Loading table data</span>
                    </div>
                  ) : null}
                  {tablePreview.result ? <ResultsTable result={tablePreview.result} /> : null}
                </>
              ) : (
                <div className="empty-state">
                  <Table2 size={22} aria-hidden="true" />
                  <span>Select a table to preview rows</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="modules" className="module-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Primavera</p>
              <h2>Module Placeholders</h2>
            </div>
          </div>

          <div className="module-grid">
            {modules.map((module) => (
              <ModuleTile key={module.key} module={module} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
