import {
  Activity,
  Banknote,
  Blocks,
  CalendarDays,
  Columns3,
  Database,
  Eye,
  FileText,
  Package,
  Percent,
  Play,
  RefreshCw,
  ReceiptText,
  Search,
  Server,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Table2,
  TerminalSquare,
  Target,
  TrendingUp,
  Users
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  executeSelectQuery,
  getDatabaseTableColumns,
  getDatabaseTableRows,
  getDatabaseTables,
  getHealth,
  getPrimaveraModules,
  getSalesDashboard,
  getVendorDocuments,
  testDatabaseConnection
} from './services/databaseApi.js';

const defaultQuery = 'SELECT TOP (@limit) * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = @tableType';
const defaultParameters = JSON.stringify({ limit: 20, tableType: 'BASE TABLE' }, null, 2);
const monthlySalesGoal = 3_200_189;
const defaultSalesDateRange = getCurrentMonthRange();
const createSalesDashboardState = () => ({ loading: false, data: null, error: null });
const createVendorDocumentsState = () => ({ loading: false, rows: [], error: null });
const salesDocumentColumns = [
  'documentDate',
  'documentType',
  'documentNumber',
  'entityCode',
  'currency',
  'netSales',
  'vatTotal',
  'grossSales'
];
const salesDocumentColumnLabels = {
  documentDate: 'Data',
  documentType: 'Tipo',
  documentNumber: 'Número',
  entityCode: 'Entidade',
  currency: 'Moeda',
  netSales: 'Vendas sem IVA',
  vatTotal: 'IVA',
  grossSales: 'Vendas com IVA'
};

const statusText = {
  idle: 'Inativo',
  loading: 'A verificar',
  ok: 'Online',
  error: 'Atenção'
};

const pages = {
  dashboard: { label: 'Geral', eyebrow: 'Geral', title: 'Painel Primavera Medimoc', icon: Activity },
  sales: { label: 'Vendas', eyebrow: 'Vendas', title: 'Vendas', icon: ShoppingCart },
  customers: { label: 'Clientes', eyebrow: 'Clientes', title: 'Clientes', icon: Users },
  products: { label: 'Produtos', eyebrow: 'Produtos', title: 'Produtos', icon: Package },
  overview: { label: 'Sistema', eyebrow: 'Sistema', title: 'Estado do sistema', icon: Server },
  query: { label: 'Consulta', eyebrow: 'Consulta SQL', title: 'Execução segura de SELECT', icon: TerminalSquare },
  data: { label: 'Dados', eyebrow: 'Base de dados', title: 'Tabelas Primavera em direto', icon: Table2 },
  modules: { label: 'Módulos', eyebrow: 'Primavera', title: 'Módulos por configurar', icon: Blocks }
};

const navigationItems = Object.entries(pages).map(([key, page]) => ({
  key,
  ...page
}));

const primaryNavigationKeys = ['dashboard', 'sales', 'customers', 'products'];
const primaryNavigationItems = navigationItems.filter((item) => primaryNavigationKeys.includes(item.key));
const settingsNavigationItems = navigationItems.filter((item) => !primaryNavigationKeys.includes(item.key));

const pieColors = ['#d00000', '#930018', '#f06a63', '#6d0012', '#c74747', '#f3aaa5'];

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

function MonthlyGoalCard({ actualSales, hasResult, loading, periodLabel }) {
  const sales = Number(actualSales ?? 0);
  const progress = Math.max(0, (sales / monthlySalesGoal) * 100);

  return (
    <section className="status-card goal-card">
      <div className="status-icon goal">
        <Target size={20} aria-hidden="true" />
      </div>
      <div className="goal-card-content">
        <p className="eyebrow">Meta mensal</p>
        <h2>{loading ? 'A carregar' : hasResult ? formatPercentage(progress) : 'Sem dados'}</h2>
        <p className="muted">
          {hasResult
            ? `${formatAmount(sales)} em ${periodLabel} de ${formatAmount(monthlySalesGoal)}`
            : `Meta: ${formatAmount(monthlySalesGoal)}`}
        </p>
        {hasResult ? (
          <>
            <div
              className="goal-progress"
              role="progressbar"
              aria-label="Progresso da meta mensal"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(progress, 100))}
            >
              <span style={{ width: `${Math.min(progress, 100)}%` }} />
            </div>
            <p className="goal-status">
              {progress >= 100 ? 'Meta atingida' : `Faltam ${formatAmount(monthlySalesGoal - sales)}`}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

function SalesDateFilter({
  dateRange,
  idPrefix,
  loading,
  onClear,
  onDateRangeChange,
  onSubmit
}) {
  return (
    <form className="date-filter" onSubmit={onSubmit}>
      <div>
        <label htmlFor={`${idPrefix}-start-date`}>Data inicial</label>
        <input
          id={`${idPrefix}-start-date`}
          type="date"
          value={dateRange.startDate}
          onChange={(event) => onDateRangeChange((current) => ({
            ...current,
            startDate: event.target.value
          }))}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-end-date`}>Data final</label>
        <input
          id={`${idPrefix}-end-date`}
          type="date"
          value={dateRange.endDate}
          onChange={(event) => onDateRangeChange((current) => ({
            ...current,
            endDate: event.target.value
          }))}
        />
      </div>
      <button className="primary-button compact" type="submit" disabled={loading}>
        <CalendarDays size={15} aria-hidden="true" />
        Aplicar
      </button>
      <button className="secondary-button compact" type="button" onClick={onClear} disabled={loading}>
        <RefreshCw size={15} aria-hidden="true" />
        Mês atual
      </button>
    </form>
  );
}

function SalesPeriodShortcuts({ dateRange, loading, onSelectPeriod }) {
  const shortcuts = [
    { key: 'day', label: 'Hoje', range: getCurrentDayRange() },
    { key: 'month', label: 'Mês', range: getCurrentMonthRange() },
    { key: 'year', label: 'Ano', range: getCurrentYearRange() }
  ];

  return (
    <div className="period-toggle" role="group" aria-label="Período de vendas">
      {shortcuts.map((shortcut) => {
        const isActive = isSameDateRange(dateRange, shortcut.range);

        return (
          <button
            className={isActive ? 'active' : ''}
            key={shortcut.key}
            type="button"
            onClick={() => onSelectPeriod(shortcut.range)}
            disabled={loading}
            aria-pressed={isActive}
          >
            {shortcut.label}
          </button>
        );
      })}
    </div>
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
  const columnLabels = result?.columnLabels ?? {};

  if (!rows.length) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>Sem registos para apresentar</span>
      </div>
    );
  }

  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{columnLabels[column] ?? column}</th>
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

function SalesDocumentsTable({ rows }) {
  return (
    <ResultsTable
      result={{
        columns: salesDocumentColumns,
        columnLabels: salesDocumentColumnLabels,
        rows
      }}
    />
  );
}

function formatRowCount(value) {
  if (value === null || value === undefined) return 'desconhecido';
  return Number(value).toLocaleString('pt-PT');
}

function formatCellValue(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat('pt-PT').format(new Date(value));
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatAmount(value) {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatPercentage(value) {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value ?? 0) + '%';
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange(referenceDate = new Date()) {
  const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const endDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate)
  };
}

function getCurrentDayRange(referenceDate = new Date()) {
  const date = formatDateInputValue(referenceDate);

  return {
    startDate: date,
    endDate: date
  };
}

function getCurrentYearRange(referenceDate = new Date()) {
  const startDate = new Date(referenceDate.getFullYear(), 0, 1);
  const endDate = new Date(referenceDate.getFullYear(), 11, 31);

  return {
    startDate: formatDateInputValue(startDate),
    endDate: formatDateInputValue(endDate)
  };
}

function isSameDateRange(left, right) {
  return left?.startDate === right?.startDate && left?.endDate === right?.endDate;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isAfterMonth(date, referenceDate) {
  return date.getFullYear() > referenceDate.getFullYear()
    || (date.getFullYear() === referenceDate.getFullYear() && date.getMonth() > referenceDate.getMonth());
}

function SalesPieChart({ items }) {
  const segments = (items ?? [])
    .map((item) => ({
      label: item.documentType,
      value: Number(item.grossSales ?? 0)
    }))
    .filter((item) => item.value > 0);

  const total = segments.reduce((sum, item) => sum + item.value, 0);

  if (!segments.length || total <= 0) {
    return (
      <section className="chart-panel">
        <div className="panel-heading">
          <Activity size={18} aria-hidden="true" />
          <span>Distribuição das vendas</span>
        </div>
        <div className="empty-state">
          <Table2 size={22} aria-hidden="true" />
          <span>Sem dados positivos para apresentar no gráfico</span>
        </div>
      </section>
    );
  }

  let cursor = 0;
  const gradientStops = segments.map((segment, index) => {
    const start = cursor;
    const end = cursor + (segment.value / total) * 100;
    cursor = end;
    return `${pieColors[index % pieColors.length]} ${start}% ${end}%`;
  });

  return (
    <section className="chart-panel">
      <div className="panel-heading">
        <Activity size={18} aria-hidden="true" />
        <span>Distribuição das vendas com IVA por tipo</span>
      </div>
      <div className="pie-layout">
        <div
          className="pie-chart"
          style={{ background: `conic-gradient(${gradientStops.join(', ')})` }}
          aria-label="Distribuição das vendas por tipo de documento"
        >
          <div className="pie-center">
            <strong>{formatAmount(total)}</strong>
            <span>Total</span>
          </div>
        </div>
        <div className="pie-legend">
          {segments.map((segment, index) => {
            const percentage = (segment.value / total) * 100;

            return (
              <div className="pie-legend-item" key={segment.label}>
                <span style={{ backgroundColor: pieColors[index % pieColors.length] }} />
                <strong>{segment.label}</strong>
                <em>{percentage.toFixed(1)}%</em>
                <small>{formatAmount(segment.value)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DocumentTypeVerticalChart({ items }) {
  const documentTypes = (items ?? [])
    .map((item) => ({
      type: item.documentType,
      documents: Number(item.documentCount ?? 0),
      netSales: Number(item.netSales ?? 0),
      vatTotal: Number(item.vatTotal ?? 0),
      grossSales: Number(item.grossSales ?? 0)
    }))
    .sort((a, b) => b.grossSales - a.grossSales);

  const maxValue = documentTypes.reduce((max, item) => Math.max(max, Math.abs(item.grossSales)), 0);

  if (!documentTypes.length || maxValue <= 0) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>Sem tipos de documento para apresentar no gráfico</span>
      </div>
    );
  }

  return (
    <div className="document-chart-layout">
      <div className="vertical-chart" aria-label="Vendas por tipo de documento">
        {documentTypes.map((item, index) => {
          const height = Math.max((Math.abs(item.grossSales) / maxValue) * 100, 6);
          const isNegative = item.grossSales < 0;

          return (
            <div className="vertical-bar-item" key={item.type}>
              <div className="vertical-bar-track">
                <div
                  className={`vertical-bar-fill ${isNegative ? 'negative' : ''}`}
                  style={{
                    height: `${height}%`,
                    backgroundColor: isNegative ? '#7b7780' : pieColors[index % pieColors.length]
                  }}
                />
              </div>
              <strong>{item.type}</strong>
            </div>
          );
        })}
      </div>

      <div className="document-breakdown">
        {documentTypes.map((item, index) => (
          <article className="document-breakdown-item" key={item.type}>
            <span style={{ backgroundColor: item.grossSales < 0 ? '#7b7780' : pieColors[index % pieColors.length] }} />
            <div>
              <strong>{item.type}</strong>
              <small>{item.documents} documentos</small>
            </div>
            <em>{formatAmount(item.grossSales)}</em>
          </article>
        ))}
      </div>
    </div>
  );
}

function VendorBarChart({ items, onSelectVendor, selectedVendorCode }) {
  const vendors = (items ?? [])
    .map((item) => ({
      code: item.vendorCode,
      name: item.vendorName,
      documents: Number(item.documentCount ?? 0),
      value: Number(item.grossSales ?? 0)
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const maxValue = vendors.reduce((max, item) => Math.max(max, item.value), 0);

  if (!vendors.length || maxValue <= 0) {
    return (
      <div className="empty-state">
        <Table2 size={22} aria-hidden="true" />
        <span>Sem vendas positivas por vendedor para apresentar no gráfico</span>
      </div>
    );
  }

  return (
    <div className="bar-chart" aria-label="Vendas por vendedor">
      {vendors.map((vendor) => {
        const percentage = Math.max((vendor.value / maxValue) * 100, 4);

        return (
          <button
            className={`bar-row ${selectedVendorCode === vendor.code ? 'selected' : ''}`}
            key={`${vendor.code}-${vendor.name}`}
            type="button"
            onClick={() => onSelectVendor?.(vendor)}
            aria-pressed={selectedVendorCode === vendor.code}
          >
            <div className="bar-label">
              <strong>{vendor.name}</strong>
              <span>{vendor.code} · {vendor.documents} documentos</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${percentage}%` }} />
            </div>
            <div className="bar-value">{formatAmount(vendor.value)}</div>
          </button>
        );
      })}
    </div>
  );
}

function formatMonthLabel(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);

  if (!year || !monthNumber) {
    return month;
  }

  return new Intl.DateTimeFormat('pt-PT', {
    month: 'short',
    year: '2-digit'
  }).format(new Date(year, monthNumber - 1, 1)).replace('.', '');
}

function parseDateInput(value) {
  const [year, month, day] = String(value ?? '').split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateLabel(value) {
  const date = parseDateInput(value);

  if (!date) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-PT').format(date);
}

function formatDateRangeLabel(dateRange) {
  const startDate = parseDateInput(dateRange?.startDate);
  const endDate = parseDateInput(dateRange?.endDate);

  if (startDate && endDate && startDate.getFullYear() === endDate.getFullYear()
    && startDate.getMonth() === endDate.getMonth()) {
    return formatMonthLabel(`${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`);
  }

  if (dateRange?.startDate && dateRange?.endDate) {
    return `${formatDateLabel(dateRange.startDate)} - ${formatDateLabel(dateRange.endDate)}`;
  }

  if (dateRange?.startDate) {
    return `Desde ${formatDateLabel(dateRange.startDate)}`;
  }

  if (dateRange?.endDate) {
    return `Até ${formatDateLabel(dateRange.endDate)}`;
  }

  return 'Todos os períodos';
}

function getSelectedMonthFromRange(dateRange) {
  return getMonthStart(parseDateInput(dateRange?.startDate) ?? parseDateInput(dateRange?.endDate) ?? new Date());
}

function getComparisonMonthDates(dateRange, referenceDate = new Date()) {
  const selectedMonth = getSelectedMonthFromRange(dateRange);
  const currentMonth = getMonthStart(referenceDate);
  const months = [
    addMonths(selectedMonth, -1),
    selectedMonth
  ];
  const nextMonth = addMonths(selectedMonth, 1);

  if (!isAfterMonth(nextMonth, currentMonth)) {
    months.push(nextMonth);
  }

  return months;
}

function getSalesComparisonDateRange(dateRange) {
  const comparisonMonths = getComparisonMonthDates(dateRange);
  const firstMonth = comparisonMonths[0];
  const lastMonth = comparisonMonths.at(-1);

  return {
    startDate: formatDateInputValue(firstMonth),
    endDate: formatDateInputValue(getMonthEnd(lastMonth))
  };
}

function buildSalesComparisonMonths(items, dateRange) {
  const rowsByMonth = new Map((items ?? []).map((item) => [item.month, item]));

  return getComparisonMonthDates(dateRange).map((monthDate) => {
    const month = getMonthKey(monthDate);

    return rowsByMonth.get(month) ?? {
      month,
      documentCount: 0,
      netSales: 0,
      vatTotal: 0,
      grossSales: 0
    };
  });
}

function formatCompactAmount(value) {
  return new Intl.NumberFormat('pt-PT', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value ?? 0);
}

function MonthlySalesLineChart({ items, loading }) {
  const monthlySales = (items ?? []).map((item) => ({
    month: item.month,
    documents: Number(item.documentCount ?? 0),
    value: Number(item.netSales ?? 0)
  }));

  if (loading) {
    return (
      <section className="monthly-chart-panel">
        <div className="panel-heading">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Vendas efetuadas por mês</span>
        </div>
        <div className="empty-state">
          <RefreshCw size={22} aria-hidden="true" />
          <span>A carregar vendas mensais</span>
        </div>
      </section>
    );
  }

  if (!monthlySales.length) {
    return (
      <section className="monthly-chart-panel">
        <div className="panel-heading">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Vendas efetuadas por mês</span>
        </div>
        <div className="empty-state">
          <Table2 size={22} aria-hidden="true" />
          <span>Sem vendas mensais para apresentar</span>
        </div>
      </section>
    );
  }

  const width = 840;
  const height = 320;
  const padding = { top: 28, right: 30, bottom: 50, left: 76 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = monthlySales.map((item) => item.value);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const valueRange = Math.max(maxValue - minValue, 1);
  const yForValue = (value) => padding.top + ((maxValue - value) / valueRange) * chartHeight;
  const xForIndex = (index) => (
    monthlySales.length === 1
      ? padding.left + chartWidth / 2
      : padding.left + (index / (monthlySales.length - 1)) * chartWidth
  );
  const points = monthlySales.map((item, index) => ({
    ...item,
    x: xForIndex(index),
    y: yForValue(item.value)
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const baseline = yForValue(0);
  const areaPath = `${linePath} L ${points.at(-1).x} ${baseline} L ${points[0].x} ${baseline} Z`;
  const gridValues = Array.from({ length: 4 }, (_value, index) => (
    maxValue - (valueRange * index) / 3
  ));

  return (
    <section className="monthly-chart-panel">
      <div className="monthly-chart-heading">
        <div className="panel-heading">
          <TrendingUp size={18} aria-hidden="true" />
          <span>Vendas efetuadas por mês</span>
        </div>
      </div>

      <div className="line-chart-shell">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Evolução mensal das vendas efetuadas">
          <defs>
            <linearGradient id="monthly-sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d00000" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#d00000" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {gridValues.map((value) => {
            const y = yForValue(value);

            return (
              <g key={value}>
                <line className="line-chart-grid" x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
                <text className="line-chart-axis-label" x={padding.left - 12} y={y + 4} textAnchor="end">
                  {formatCompactAmount(value)}
                </text>
              </g>
            );
          })}

          <path className="line-chart-area" d={areaPath} />
          <path className="line-chart-line" d={linePath} />

          {points.map((point) => (
            <g className="line-chart-point" key={point.month}>
              <title>{`${formatMonthLabel(point.month)}: ${formatAmount(point.value)} (${point.documents} documentos)`}</title>
              <circle cx={point.x} cy={point.y} r="5" />
              <text className="line-chart-month" x={point.x} y={height - 20} textAnchor="middle">
                {formatMonthLabel(point.month)}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function SalesPage({
  activePeriodLabel,
  salesComparisonMonths,
  salesDashboard,
  salesDateRange,
  onSelectPeriod,
}) {
  const summary = salesDashboard.data?.summary ?? null;
  const documentCount = Number(summary?.documentCount ?? 0);
  const netSales = Number(summary?.netSales ?? 0);
  const grossSales = Number(summary?.grossSales ?? 0);
  const vatTotal = Number(summary?.vatTotal ?? 0);
  const averageDocumentValue = documentCount > 0 ? grossSales / documentCount : 0;
  const hasResult = Boolean(salesDashboard.data);

  return (
    <section className="sales-page">
      <div className="section-heading sales-page-heading">
        <div>
          <p className="eyebrow">Vendas</p>
          <h2>Gestão de vendas</h2>
        </div>
        <div className="sales-heading-actions">
          <SalesPeriodShortcuts
            dateRange={salesDateRange}
            loading={salesDashboard.loading}
            onSelectPeriod={onSelectPeriod}
          />
          <span className="pill">{activePeriodLabel}</span>
        </div>
      </div>

      {salesDashboard.error ? <div className="error-banner">{salesDashboard.error}</div> : null}

      <div className="sales-kpi-grid">
        <StatusCard
          icon={Banknote}
          label="Vendas sem IVA"
          value={salesDashboard.loading ? 'A carregar' : formatAmount(netSales)}
          tone="success"
          detail={hasResult ? `Total líquido em ${activePeriodLabel}` : 'Sem vendas disponíveis no período'}
        />
        <StatusCard
          icon={ReceiptText}
          label="Vendas com IVA"
          value={salesDashboard.loading ? 'A carregar' : formatAmount(grossSales)}
          tone="neutral"
          detail={hasResult ? `Valor bruto em ${activePeriodLabel}` : 'Sem vendas disponíveis no período'}
        />
        <StatusCard
          icon={Percent}
          label="IVA"
          value={salesDashboard.loading ? 'A carregar' : formatAmount(vatTotal)}
          tone="neutral"
          detail={hasResult ? `IVA liquidado em ${activePeriodLabel}` : 'Sem IVA disponível no período'}
        />
        <StatusCard
          icon={FileText}
          label="Documentos"
          value={salesDashboard.loading ? 'A carregar' : formatRowCount(documentCount)}
          tone="neutral"
          detail={hasResult ? `Ticket médio ${formatAmount(averageDocumentValue)}` : 'Sem documentos disponíveis'}
        />
      </div>

      <div className="sales-main-grid">
        <MonthlySalesLineChart
          items={salesComparisonMonths}
          loading={salesDashboard.loading}
        />
        <MonthlyGoalCard
          actualSales={summary?.netSales}
          hasResult={hasResult}
          loading={salesDashboard.loading}
          periodLabel={activePeriodLabel}
        />
      </div>
    </section>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState({ status: 'idle', data: null, error: null });
  const [database, setDatabase] = useState({ status: 'idle', data: null, error: null });
  const [modules, setModules] = useState([]);
  const [generalSalesDashboard, setGeneralSalesDashboard] = useState(createSalesDashboardState);
  const [generalSalesDateRange, setGeneralSalesDateRange] = useState(defaultSalesDateRange);
  const [generalSelectedVendor, setGeneralSelectedVendor] = useState(null);
  const [generalVendorDocuments, setGeneralVendorDocuments] = useState(createVendorDocumentsState);
  const [vendasSalesDashboard, setVendasSalesDashboard] = useState(createSalesDashboardState);
  const [vendasSalesDateRange, setVendasSalesDateRange] = useState(defaultSalesDateRange);
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
  const appName = import.meta.env.VITE_APP_NAME || 'Painel Primavera Medimoc';
  const activePageInfo = pages[activePage] ?? pages.dashboard;
  const ActivePageIcon = activePageInfo.icon;
  const isSettingsPage = settingsNavigationItems.some((item) => item.key === activePage);
  const generalSalesSummary = generalSalesDashboard.data?.summary ?? null;
  const generalActiveSalesDateRange = generalSalesDashboard.data?.dateRange ?? generalSalesDateRange;
  const generalActivePeriodLabel = useMemo(
    () => formatDateRangeLabel(generalActiveSalesDateRange),
    [generalActiveSalesDateRange]
  );
  const generalSalesComparisonMonths =
    generalSalesDashboard.data?.comparisonMonths ?? generalSalesDashboard.data?.byMonth ?? [];
  const generalVisibleRecentDocuments = generalSelectedVendor
    ? generalVendorDocuments.rows
    : generalSalesDashboard.data?.recentDocuments ?? [];
  const generalRecentDocumentsTitle = generalSelectedVendor
    ? `Documentos recentes - ${generalSelectedVendor.name}`
    : 'Documentos de venda recentes';
  const vendasActiveSalesDateRange = vendasSalesDashboard.data?.dateRange ?? vendasSalesDateRange;
  const vendasActivePeriodLabel = useMemo(
    () => formatDateRangeLabel(vendasActiveSalesDateRange),
    [vendasActiveSalesDateRange]
  );
  const vendasSalesComparisonMonths =
    vendasSalesDashboard.data?.comparisonMonths ?? vendasSalesDashboard.data?.byMonth ?? [];

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

  const loadSalesDashboardData = async ({
    filters,
    setDashboard,
    setSelectedVendor,
    setVendorDocuments
  }) => {
    setDashboard((current) => ({ ...current, loading: true, error: null }));
    setSelectedVendor?.(null);
    setVendorDocuments?.(createVendorDocumentsState());

    try {
      const comparisonDateRange = getSalesComparisonDateRange(filters);
      const [response, comparisonResponse] = await Promise.all([
        getSalesDashboard(filters),
        getSalesDashboard(comparisonDateRange)
      ]);
      const comparisonMonths = buildSalesComparisonMonths(comparisonResponse.data?.byMonth, filters);

      setDashboard({
        loading: false,
        data: {
          ...response.data,
          comparisonMonths
        },
        error: null
      });
    } catch (error) {
      setDashboard({ loading: false, data: null, error: error.message });
    }
  };

  const loadGeneralSalesDashboard = (filters = generalSalesDateRange) => loadSalesDashboardData({
    filters,
    setDashboard: setGeneralSalesDashboard,
    setSelectedVendor: setGeneralSelectedVendor,
    setVendorDocuments: setGeneralVendorDocuments
  });

  const loadVendasSalesDashboard = (filters = vendasSalesDateRange) => loadSalesDashboardData({
    filters,
    setDashboard: setVendasSalesDashboard
  });

  const loadVendorDocumentsForView = async ({
    dateRange,
    setSelectedVendor,
    setVendorDocuments,
    vendor
  }) => {
    setSelectedVendor(vendor);
    setVendorDocuments({ loading: true, rows: [], error: null });

    try {
      const response = await getVendorDocuments({
        vendorCode: vendor.code,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 12
      });

      setVendorDocuments({
        loading: false,
        rows: response?.data?.rows ?? [],
        error: null
      });
    } catch (error) {
      setVendorDocuments({ loading: false, rows: [], error: error.message });
    }
  };

  const loadGeneralVendorDocuments = (vendor) => loadVendorDocumentsForView({
    dateRange: generalActiveSalesDateRange,
    setSelectedVendor: setGeneralSelectedVendor,
    setVendorDocuments: setGeneralVendorDocuments,
    vendor
  });

  const clearGeneralVendorDocuments = () => {
    setGeneralSelectedVendor(null);
    setGeneralVendorDocuments(createVendorDocumentsState());
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

  const submitGeneralSalesDateRange = (event) => {
    event.preventDefault();
    loadGeneralSalesDashboard(generalSalesDateRange);
  };

  const clearGeneralSalesDateRange = () => {
    const currentMonthRange = getCurrentMonthRange();
    setGeneralSalesDateRange(currentMonthRange);
    loadGeneralSalesDashboard(currentMonthRange);
  };

  const applyVendasSalesDatePreset = (dateRange) => {
    setVendasSalesDateRange(dateRange);
    loadVendasSalesDashboard(dateRange);
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
    loadGeneralSalesDashboard();
    loadModules();
  }, []);

  useEffect(() => {
    if (activePage === 'data' && !tablesState.loading && tablesState.tables.length === 0) {
      loadTables('');
    }
  }, [activePage]);

  useEffect(() => {
    if (
      activePage === 'sales' &&
      !vendasSalesDashboard.loading &&
      !vendasSalesDashboard.data &&
      !vendasSalesDashboard.error
    ) {
      loadVendasSalesDashboard();
    }
  }, [activePage]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand">
          <div className="brand-mark">
            <img src="/medimoc-logo.png" alt="Medimoc" />
          </div>
          <div>
            <strong>Medimoc</strong>
          </div>
        </div>

        <nav className="primary-navigation">
          {primaryNavigationItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                className={activePage === item.key ? 'active' : ''}
                key={item.key}
                type="button"
                onClick={() => {
                  setActivePage(item.key);
                  setSettingsOpen(false);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {settingsOpen ? (
            <nav className="settings-navigation" id="settings-navigation" aria-label="Definições">
              {settingsNavigationItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    className={activePage === item.key ? 'active' : ''}
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActivePage(item.key);
                      setSettingsOpen(false);
                    }}
                  >
                    <Icon size={18} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          ) : null}

          <button
            className={`settings-trigger ${settingsOpen || isSettingsPage ? 'active' : ''}`}
            type="button"
            onClick={() => setSettingsOpen((isOpen) => !isOpen)}
            aria-expanded={settingsOpen}
            aria-controls="settings-navigation"
          >
            <Settings size={18} aria-hidden="true" />
            Definições
          </button>
        </div>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activePageInfo.eyebrow}</p>
            <h1>{activePage === 'dashboard' ? appName : activePageInfo.title}</h1>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              refreshStatus();
              if (activePage === 'sales') {
                loadVendasSalesDashboard();
                return;
              }

              if (activePage === 'dashboard') {
                loadGeneralSalesDashboard();
              }
            }}
            aria-label="Atualizar painel"
          >
            <RefreshCw size={18} aria-hidden="true" />
          </button>
        </header>

        {activePage === 'dashboard' ? (
          <section className="sales-dashboard">
            <div className="section-heading">
              <div>
                <h2>Resumo mensal de vendas</h2>
              </div>
              <span className="pill">{generalActivePeriodLabel}</span>
            </div>

            <SalesDateFilter
              dateRange={generalSalesDateRange}
              idPrefix="dashboard-sales"
              loading={generalSalesDashboard.loading}
              onClear={clearGeneralSalesDateRange}
              onDateRangeChange={setGeneralSalesDateRange}
              onSubmit={submitGeneralSalesDateRange}
            />

            {generalSalesDashboard.error ? <div className="error-banner">{generalSalesDashboard.error}</div> : null}

            <div className="metric-grid">
              <StatusCard
                icon={Database}
                label="Vendas"
                value={generalSalesDashboard.loading ? 'A carregar' : formatAmount(generalSalesSummary?.netSales)}
                tone="success"
                detail={generalSalesDashboard.data
                  ? `Total de vendas no período ${generalActivePeriodLabel}`
                  : 'Sem vendas disponíveis no período'}
              />
              <StatusCard
                icon={Table2}
                label="Documentos"
                value={
                  generalSalesDashboard.loading
                    ? 'A carregar'
                    : formatRowCount(generalSalesSummary?.documentCount ?? 0)
                }
                tone="neutral"
                detail={generalSalesDashboard.data
                  ? `Documentos emitidos no período ${generalActivePeriodLabel}`
                  : 'Sem documentos disponíveis no período'}
              />
              <MonthlyGoalCard
                actualSales={generalSalesSummary?.netSales}
                hasResult={Boolean(generalSalesDashboard.data)}
                loading={generalSalesDashboard.loading}
                periodLabel={generalActivePeriodLabel}
              />
            </div>

            <MonthlySalesLineChart
              items={generalSalesComparisonMonths}
              loading={generalSalesDashboard.loading}
            />

            <SalesPieChart items={generalSalesDashboard.data?.byDocumentType ?? []} />

            <div className="dashboard-details">
              <section className="detail-panel">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>Tipos de documento</span>
                </div>
                <DocumentTypeVerticalChart items={generalSalesDashboard.data?.byDocumentType ?? []} />
              </section>

              <section className="detail-panel vendor-panel">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>Vendas por vendedor</span>
                </div>
                <p className="panel-note">
                  Totais calculados apenas com documentos FA e VD, usando o responsável de cobrança do documento.
                </p>
                <VendorBarChart
                  items={generalSalesDashboard.data?.byVendor ?? []}
                  onSelectVendor={loadGeneralVendorDocuments}
                  selectedVendorCode={generalSelectedVendor?.code}
                />
              </section>
            </div>

            <section className="detail-panel recent-documents-panel">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>{generalRecentDocumentsTitle}</span>
                  {generalSelectedVendor ? (
                    <button className="text-button" type="button" onClick={clearGeneralVendorDocuments}>
                      Ver todos
                    </button>
                  ) : null}
                </div>
                {generalVendorDocuments.loading ? (
                  <div className="empty-state compact-empty-state">
                    <RefreshCw size={18} aria-hidden="true" />
                    <span>A carregar documentos do vendedor</span>
                  </div>
                ) : null}
                {generalVendorDocuments.error ? <div className="error-banner">{generalVendorDocuments.error}</div> : null}
                {!generalVendorDocuments.loading ? (
                  <SalesDocumentsTable rows={generalVisibleRecentDocuments} />
                ) : null}
              </section>
          </section>
        ) : null}

        {activePage === 'sales' ? (
          <SalesPage
            activePeriodLabel={vendasActivePeriodLabel}
            salesComparisonMonths={vendasSalesComparisonMonths}
            salesDashboard={vendasSalesDashboard}
            salesDateRange={vendasSalesDateRange}
            onSelectPeriod={applyVendasSalesDatePreset}
          />
        ) : null}

        {['customers', 'products'].includes(activePage) ? (
          <section className="empty-state page-empty-state">
            <ActivePageIcon size={22} aria-hidden="true" />
            <span>Sem dados configurados para apresentar nesta área</span>
          </section>
        ) : null}

        {activePage === 'overview' ? (
          <section className="status-grid" aria-label="Estado do sistema">
            <StatusCard
              icon={Server}
              label="API"
              value={statusText[health.status]}
              tone={health.status === 'ok' ? 'success' : health.status === 'error' ? 'danger' : 'neutral'}
              detail={health.data?.timestamp ?? apiBaseUrl}
            />
            <StatusCard
              icon={Database}
              label="Base de dados"
              value={statusText[database.status]}
              tone={database.status === 'ok' ? 'success' : database.status === 'error' ? 'danger' : 'neutral'}
              detail={databaseDetail}
            />
            <StatusCard
              icon={ShieldCheck}
              label="Segurança"
              value="Parametrizado"
              tone="success"
              detail="Execução apenas de consultas SELECT"
            />
          </section>
        ) : null}

        {activePage === 'query' ? (
          <section className="workbench">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Consulta SQL</p>
                <h2>Execução segura de SELECT</h2>
              </div>
              {queryState.result ? (
                <span className="pill">{queryState.result.returnedRows} linhas</span>
              ) : null}
            </div>

            <form className="query-form" onSubmit={runQuery}>
              <label htmlFor="query">Consulta</label>
              <textarea
                id="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={6}
                spellCheck="false"
              />

              <div className="form-grid">
                <div>
                  <label htmlFor="parameters">Parâmetros JSON</label>
                  <textarea
                    id="parameters"
                    value={parameters}
                    onChange={(event) => setParameters(event.target.value)}
                    rows={6}
                    spellCheck="false"
                  />
                </div>
                <div>
                  <label htmlFor="maxRows">Máximo de linhas</label>
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
                    {queryState.loading ? 'A executar' : 'Executar consulta'}
                  </button>
                </div>
              </div>
            </form>

            {queryState.error ? <div className="error-banner">{queryState.error}</div> : null}
            {queryState.result ? <ResultsTable result={queryState.result} /> : null}
          </section>
        ) : null}

        {activePage === 'data' ? (
          <section className="data-browser">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Base de dados</p>
                <h2>Tabelas Primavera em direto</h2>
              </div>
              <form className="table-search" onSubmit={submitTableSearch}>
                <input
                  aria-label="Pesquisar tabelas"
                  placeholder="Pesquisar tabelas"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                />
                <button className="secondary-button" type="submit" disabled={tablesState.loading}>
                  <Search size={17} aria-hidden="true" />
                  Pesquisar
                </button>
              </form>
            </div>

            {tablesState.error ? <div className="error-banner">{tablesState.error}</div> : null}

            <div className="browser-layout">
              <aside className="table-list-panel" aria-label="Tabelas da base de dados">
                <div className="panel-heading">
                  <Table2 size={18} aria-hidden="true" />
                  <span>{tablesState.loading ? 'A carregar tabelas' : `${tablesState.tables.length} tabelas`}</span>
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
                        <span>{formatRowCount(table.rowCount)} linhas</span>
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
                        <p className="eyebrow">Tabela selecionada</p>
                        <h3>
                          {selectedTable.schemaName}.{selectedTable.tableName}
                        </h3>
                      </div>
                      <div className="preview-controls">
                        <label htmlFor="previewLimit">Linhas</label>
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
                          Pré-visualizar
                        </button>
                      </div>
                    </div>

                    <div className="columns-strip" aria-label="Colunas da tabela">
                      <Columns3 size={17} aria-hidden="true" />
                      {tablePreview.columns.length ? (
                        tablePreview.columns.map((column) => (
                          <span key={column.columnName}>
                            {column.columnName}
                            <small>{column.dataType}</small>
                          </span>
                        ))
                      ) : (
                        <span>Sem colunas carregadas</span>
                      )}
                    </div>

                    {tablePreview.error ? <div className="error-banner">{tablePreview.error}</div> : null}
                    {tablePreview.loading ? (
                      <div className="empty-state">
                        <RefreshCw size={22} aria-hidden="true" />
                        <span>A carregar dados da tabela</span>
                      </div>
                    ) : null}
                    {tablePreview.result ? <ResultsTable result={tablePreview.result} /> : null}
                  </>
                ) : (
                  <div className="empty-state">
                    <Table2 size={22} aria-hidden="true" />
                    <span>Selecione uma tabela para pré-visualizar linhas</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activePage === 'modules' ? (
          <section className="module-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Primavera</p>
                <h2>Módulos por configurar</h2>
              </div>
            </div>

            <div className="module-grid">
              {modules.map((module) => (
                <ModuleTile key={module.key} module={module} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
